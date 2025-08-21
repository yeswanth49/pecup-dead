import { google } from 'googleapis'
import { createSupabaseAdmin } from '@/lib/supabase'

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


