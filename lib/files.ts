import { google } from 'googleapis'
import { createSupabaseAdmin } from '@/lib/supabase'
import { UserContext } from '@/lib/auth-permissions'

// Configuration for secure storage
const SECURE_STORAGE_BUCKET = 'secure-resources'
const SIGNED_URL_EXPIRY_SECONDS = 3600 // 1 hour
const MAX_DOWNLOAD_SIZE_BYTES = 100 * 1024 * 1024 // 100MB limit

export async function deleteDriveFile(fileId: string) {
  let credentials
  try {
    const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    let raw = rawJson || '{}'
    if (rawB64) {
      raw = Buffer.from(rawB64, 'base64').toString('utf8')
    }
    credentials = JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse Google credentials in deleteDriveFile:', e)
    throw new Error('Google Drive configuration error')
  }
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] })
  const drive = google.drive({ version: 'v3', auth })
  await drive.files.delete({ fileId })
}

export async function deleteStorageObject(bucket: string, path: string) {
  const supabase = createSupabaseAdmin()
  await supabase.storage.from(bucket).remove([path])
}

export function tryParseDriveIdFromUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  return match?.[1] || null
}

export function tryParseStoragePathFromUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/object\/public\/([^/]+)\/(.+)$/)
  if (!match) return null
  return { bucket: match[1], path: match[2] }
}

/**
 * Generate a signed URL for secure file access with permission checks
 */
export async function generateSecureFileUrl(
  resourceId: string,
  userContext: UserContext
): Promise<{ url: string; expiresAt: Date } | null> {
  const supabase = createSupabaseAdmin()

  // 1. Get resource details from database
  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('file_path, storage_location, branch_id, year_id, semester_id')
    .eq('id', resourceId)
    .single()

  if (resourceError || !resource) {
    console.warn('Resource not found or access error:', resourceError?.message)
    return null
  }

  // 2. Check user permissions for this resource
  const hasAccess = await checkResourceAccess(resource, userContext)
  if (!hasAccess) {
    console.warn('Access denied for user', userContext.email, 'to resource', resourceId)
    return null
  }

  // 3. Generate signed URL based on storage location
  if (resource.storage_location === 'Supabase Storage' && resource.file_path) {
    return await generateSupabaseSignedUrl(resource.file_path)
  } else if (resource.storage_location === 'Google Drive' && resource.file_path) {
    return await generateDriveSignedUrl(resource.file_path)
  }

  console.warn('Unsupported storage location:', resource.storage_location)
  return null
}

/**
 * Check if user has access to a specific resource based on their role and assignments
 */
async function checkResourceAccess(
  resource: { branch_id: string; year_id: string; semester_id: string },
  userContext: UserContext
): Promise<boolean> {
  // Admins and superadmins have access to all resources
  if (userContext.role === 'admin' || userContext.role === 'superadmin') {
    return true
  }

  // Students can access resources for their branch/year/semester
  if (userContext.role === 'student') {
    return (
      userContext.branchId === resource.branch_id &&
      userContext.yearId === resource.year_id &&
      userContext.semesterId === resource.semester_id
    )
  }

  // Representatives can access resources for their assigned branch/year
  if (userContext.role === 'representative') {
    return userContext.representativeAssignments?.some(assignment =>
      assignment.branch_id === resource.branch_id &&
      assignment.year_id === resource.year_id
    ) || false
  }

  // Default deny
  return false
}

/**
 * Generate signed URL for Supabase Storage files
 */
async function generateSupabaseSignedUrl(filePath: string): Promise<{ url: string; expiresAt: Date }> {
  const supabase = createSupabaseAdmin()

  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000)

  const { data, error } = await supabase.storage
    .from(SECURE_STORAGE_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS, {
      download: true
    })

  if (error || !data) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`)
  }

  return {
    url: data.signedUrl,
    expiresAt
  }
}

/**
 * Generate signed URL for Google Drive files (temporary solution during migration)
 */
async function generateDriveSignedUrl(filePath: string): Promise<{ url: string; expiresAt: Date }> {
  // For Google Drive files, we'll create a temporary signed URL that includes
  // permission validation. This is a bridge solution until migration is complete.

  const driveFileId = tryParseDriveIdFromUrl(filePath)
  if (!driveFileId) {
    throw new Error('Invalid Google Drive file path')
  }

  // Create a temporary access token that expires in 1 hour
  // This is a simplified approach - in production, you'd want more sophisticated token management
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000)
  const tempToken = Buffer.from(JSON.stringify({
    fileId: driveFileId,
    expiresAt: expiresAt.toISOString()
  })).toString('base64')

  // Return a URL that goes through our secure proxy
  const secureUrl = `${process.env.NEXTAUTH_URL}/api/secure-file/${tempToken}`

  return {
    url: secureUrl,
    expiresAt
  }
}

/**
 * Migrate a file from public storage to secure storage
 */
export async function migrateFileToSecureStorage(
  currentPath: string,
  storageLocation: string
): Promise<string | null> {
  const supabase = createSupabaseAdmin()

  try {
    if (storageLocation === 'Google Drive') {
      // Download from Google Drive and upload to secure storage
      const driveFileId = tryParseDriveIdFromUrl(currentPath)
      if (!driveFileId) {
        console.error('Invalid Google Drive file path for migration:', currentPath)
        return null
      }

      // Get Google Drive credentials
      let credentials
      try {
        const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
        const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
        let raw = rawJson || '{}'
        if (rawB64) {
          raw = Buffer.from(rawB64, 'base64').toString('utf8')
        }
        credentials = JSON.parse(raw)
      } catch (e) {
        console.error('Failed to parse Google credentials for migration:', e)
        return null
      }

      const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] })
      const drive = google.drive({ version: 'v3', auth })

      // Download file from Google Drive
      const response = await drive.files.get({
        fileId: driveFileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      })

      const buffer = Buffer.from(response.data as ArrayBuffer)
      const fileName = `migrated-${Date.now()}-${driveFileId}.pdf`

      // Upload to secure Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SECURE_STORAGE_BUCKET)
        .upload(fileName, buffer, {
          contentType: 'application/pdf',
          duplex: 'half'
        })

      if (uploadError) {
        console.error('Failed to upload migrated file to secure storage:', uploadError)
        return null
      }

      console.log('Successfully migrated file from Google Drive to secure storage:', fileName)
      return fileName

    } else if (storageLocation === 'Supabase Storage') {
      // Move from public bucket to secure bucket
      const publicPath = tryParseStoragePathFromUrl(currentPath)
      if (!publicPath || publicPath.bucket === SECURE_STORAGE_BUCKET) {
        return publicPath?.path || null
      }

      // Download from public bucket
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(publicPath.bucket)
        .download(publicPath.path)

      if (downloadError || !fileData) {
        console.error('Failed to download file from public storage:', downloadError)
        return null
      }

      // Upload to secure bucket
      const secureFileName = `migrated-${Date.now()}-${publicPath.path}`
      const { error: uploadError } = await supabase.storage
        .from(SECURE_STORAGE_BUCKET)
        .upload(secureFileName, fileData, {
          duplex: 'half'
        })

      if (uploadError) {
        console.error('Failed to upload migrated file to secure storage:', uploadError)
        return null
      }

      // Remove from public bucket
      await supabase.storage
        .from(publicPath.bucket)
        .remove([publicPath.path])

      console.log('Successfully migrated file from public to secure storage:', secureFileName)
      return secureFileName
    }

    console.warn('Unsupported storage location for migration:', storageLocation)
    return null

  } catch (error) {
    console.error('File migration error:', error)
    return null
  }
}


