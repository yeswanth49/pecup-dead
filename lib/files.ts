import { google } from 'googleapis'
import { createSupabaseAdmin } from '@/lib/supabase'
import { UserContext } from '@/lib/types/auth'
import jwt from 'jsonwebtoken'

// Simple in-memory rate limiter for file operations
// In production, this should be replaced with Redis or similar
const operationCache = new Map<string, { count: number; resetTime: number }>()

/**
 * Simple rate limiter - limits operations per user per time window
 */
export function checkRateLimit(userId: string, operation: string, maxOperations = 10, windowMs = 60000): boolean {
  const key = `${userId}:${operation}`
  const now = Date.now()
  const record = operationCache.get(key)

  if (!record || now > record.resetTime) {
    operationCache.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxOperations) {
    return false
  }

  record.count++
  return true
}

// Configuration for secure storage - configurable via environment variables
const SECURE_STORAGE_BUCKET = process.env.SECURE_STORAGE_BUCKET || 'secure-resources'
const SIGNED_URL_EXPIRY_SECONDS = (() => {
  const parsed = parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '3600', 10)
  return isFinite(parsed) && parsed > 0 ? parsed : 3600
})()
const MAX_DOWNLOAD_SIZE_BYTES = (() => {
  const parsed = parseInt(process.env.MAX_DOWNLOAD_SIZE_BYTES || '104857600', 10) // 100MB default
  return isFinite(parsed) && parsed > 0 ? parsed : 100 * 1024 * 1024
})()

/**
 * Extract and parse Google credentials from environment variables
 */
function getGoogleCredentials(): any {
  try {
    const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    let raw = rawJson || '{}'
    if (rawB64) {
      raw = Buffer.from(rawB64, 'base64').toString('utf8')
    }
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse Google credentials:', e)
    throw new Error('Google Drive configuration error')
  }
}

/**
 * Validate that a string is a valid UUID v4 or v1
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Determine file extension from MIME type or filename, with safe fallback
 */
function determineFileExtension(mimeType?: string, originalFilename?: string): string {
  // Try to extract extension from original filename first
  if (originalFilename) {
    const ext = originalFilename.split('.').pop()?.toLowerCase()
    if (ext && /^[a-z0-9]{1,5}$/.test(ext)) { // Basic validation: alphanumeric, max 5 chars
      return ext
    }
  }

  // Map common MIME types to extensions
  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'text/plain': 'txt',
    'application/zip': 'zip'
  }

  if (mimeType && mimeToExt[mimeType]) {
    return mimeToExt[mimeType]
  }

  // Safe fallback
  return 'bin'
}

export async function deleteDriveFile(fileId: string) {
  const credentials = getGoogleCredentials()
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
  // Validate resourceId input
  if (!resourceId || typeof resourceId !== 'string' || resourceId.trim() === '') {
    console.warn('Invalid resourceId: empty or non-string value')
    return null
  }

  if (!isValidUUID(resourceId)) {
    console.warn('Invalid resourceId format: not a valid UUID v4/v1', resourceId)
    return null
  }

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

  // Create a JWT token that expires in configured time
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000)

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required')
  }

  const payload = {
    fileId: driveFileId,
    exp: Math.floor(expiresAt.getTime() / 1000)
  }

  const tempToken = jwt.sign(payload, jwtSecret, { algorithm: 'HS256' })

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
      const credentials = getGoogleCredentials()

      const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] })
      const drive = google.drive({ version: 'v3', auth })

      // Get file metadata first to determine the correct extension
      let fileMetadata
      try {
        const metadataResponse = await drive.files.get({
          fileId: driveFileId,
          fields: 'name,mimeType,size'
        })
        fileMetadata = metadataResponse.data
      } catch (metadataError: any) {
        console.error('Failed to get Google Drive file metadata:', {
          fileId: driveFileId,
          error: metadataError?.message || metadataError,
          operation: 'getFileMetadata'
        })
        return null
      }

      const originalFilename = fileMetadata.name
      const mimeType = fileMetadata.mimeType
      const fileSize = Number(fileMetadata.size) || 0

      // Check file size before downloading
      if (fileSize > MAX_DOWNLOAD_SIZE_BYTES) {
        console.error(`File too large for migration: ${fileSize} bytes (max: ${MAX_DOWNLOAD_SIZE_BYTES}) for file ${driveFileId}`)
        return null
      }

      // Download file content
      let response
      try {
        response = await drive.files.get({
          fileId: driveFileId,
          alt: 'media'
        }, {
          responseType: 'arraybuffer'
        })
      } catch (downloadError: any) {
        console.error('Failed to download from Google Drive:', {
          fileId: driveFileId,
          fileSize,
          error: downloadError?.message || downloadError,
          operation: 'downloadFile'
        })
        return null
      }

      const buffer = Buffer.from(response.data as ArrayBuffer)
      const extension = determineFileExtension(mimeType, originalFilename as any)
      const fileName = `migrated-${Date.now()}-${driveFileId}.${extension}`

      // Upload to secure Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SECURE_STORAGE_BUCKET)
        .upload(fileName, buffer, {
          contentType: 'application/pdf'
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
        console.error('Failed to download file from public storage:', downloadError, 'for path:', publicPath.path)
        return null
      }

      // Check file size before uploading
      const fileSize = fileData.size
      if (fileSize > MAX_DOWNLOAD_SIZE_BYTES) {
        console.error(`File too large for migration: ${fileSize} bytes (max: ${MAX_DOWNLOAD_SIZE_BYTES}) for path ${publicPath.bucket}/${publicPath.path}`)
        return null
      }

      // Upload to secure bucket
      const secureFileName = `migrated-${Date.now()}-${publicPath.path}`
      const { error: uploadError } = await supabase.storage
        .from(SECURE_STORAGE_BUCKET)
        .upload(secureFileName, fileData, {
          // No duplex property needed for buffer uploads
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

  } catch (error: any) {
    console.error('File migration error:', {
      operation: 'migrateFileToSecureStorage',
      currentPath,
      storageLocation,
      error: error?.message || error,
      stack: error?.stack
    })
    return null
  }
}


