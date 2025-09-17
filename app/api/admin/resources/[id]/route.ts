import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin, getSettings } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { validateFile } from '@/lib/file-validation'
import { tryParseDriveIdFromUrl, tryParseStoragePathFromUrl } from '@/lib/files'

export const runtime = 'nodejs'
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

async function deleteUnderlying(url: string) {
  const driveId = tryParseDriveIdFromUrl(url)
  const storagePath = tryParseStoragePathFromUrl(url)
  if (driveId) {
    let credentials
    try {
      const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
      const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
      let raw = rawJson || '{}'
      if (rawB64) raw = Buffer.from(rawB64, 'base64').toString('utf8')
      credentials = JSON.parse(raw)
    } catch (e) {
      console.error('Failed to parse Google credentials in deleteUnderlying:', e)
      throw new Error('Google Drive configuration error')
    }
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] })
    const drive = google.drive({ version: 'v3', auth })
    await drive.files.delete({ fileId: driveId })
    return
  }
  if (storagePath) {
    const supabase = createSupabaseAdmin()
    await supabase.storage.from(storagePath.bucket).remove([storagePath.path])
    return
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  const id = params.id
  try {
    const contentType = request.headers.get('content-type') || ''
    const { data: before } = await supabase.from('resources').select('*').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let update: any = {}
    let file: File | null = null
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      for (const k of form.keys()) if (k !== 'file') update[k] = form.get(k)
      file = (form.get('file') as unknown as File) || null
    } else {
      update = await request.json()
    }

    // Clean update fields
    const allowed = ['category', 'subject', 'unit', 'name', 'description', 'type', 'year', 'branch', 'archived']
    const sanitized: Record<string, any> = {}
    for (const k of allowed) if (k in update) sanitized[k] = update[k]
    if (sanitized.subject) sanitized.subject = String(sanitized.subject).toLowerCase()
    if (sanitized.unit) sanitized.unit = Number.parseInt(String(sanitized.unit), 10)
    if (typeof sanitized.archived !== 'undefined') sanitized.archived = Boolean(sanitized.archived)

    // Enforce scope for non-yeshh
    try {
      const session = await getServerSession(authOptions)
      const email = session?.user?.email?.toLowerCase()
      if (email) {
        const { data: adminRow } = await supabase.from('profiles').select('id,role').eq('email', email).maybeSingle()
        if (adminRow && adminRow.role !== 'yeshh') {
          const { data: scopes } = await supabase
            .from('admin_scopes')
            .select('year,branch')
            .eq('admin_id', adminRow.id)
          if (scopes && scopes.length > 0) {
            const years = new Set(scopes.map((s: any) => s.year))
            const branches = new Set(scopes.map((s: any) => s.branch))
            const targetYear = 'year' in sanitized ? sanitized.year : before.year
            const targetBranch = 'branch' in sanitized ? sanitized.branch : before.branch
            if (!years.has(targetYear) || !branches.has(targetBranch)) {
              return NextResponse.json({ error: 'Forbidden: outside your scope' }, { status: 403 })
            }
          }
        }
      }
    } catch {}

    if (file) {
      // Replace flow: delete old first, then upload new
      if (before.url) {
        try { await deleteUnderlying(before.url) } catch (e) { return NextResponse.json({ error: 'Failed to delete previous file' }, { status: 500 }) }
      }
      const originalName = (file as any).name as string
      const clientMime = (file as any).type as string | undefined
      const size = (file as any).size as number | undefined
      if (typeof size === 'number' && size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 413 })
      const buffer = Buffer.from(await file.arrayBuffer())
      const validation = validateFile(buffer, originalName, clientMime)
      if (!validation.ok) return NextResponse.json({ error: 'Unsupported file type', reason: validation.reason }, { status: 415 })
      const effectiveMime = (validation.detectedMime || clientMime || '').toLowerCase()
      const is_pdf = effectiveMime === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')

      const settings = await getSettings()
      if (is_pdf && settings?.pdf_to_drive) {
        const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'), scopes: ['https://www.googleapis.com/auth/drive'] })
        const drive = google.drive({ version: 'v3', auth })
        const { data } = await drive.files.create({ requestBody: { name: originalName, parents: [settings.drive_folder_id || process.env.GOOGLE_DRIVE_FOLDER_ID as string] }, media: { mimeType: effectiveMime || 'application/pdf', body: Readable.from(buffer) }, fields: 'id,webViewLink' })
        await drive.permissions.create({ fileId: data.id!, requestBody: { role: 'reader', type: 'anyone' } })
        sanitized.url = data.webViewLink || `https://drive.google.com/file/d/${data.id}/view?usp=sharing`
        sanitized.is_pdf = true
      } else {
        const bucket = settings?.storage_bucket || 'resources'
        const path = `${Date.now()}-${originalName}`
        const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType: effectiveMime || undefined, duplex: 'half' as any })
        if (error) return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        sanitized.url = data.publicUrl
        sanitized.is_pdf = false
      }
    }

    const { data, error } = await supabase
      .from('resources')
      .update(sanitized)
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'resource', entity_id: id, before_data: before, after_data: data })
    return NextResponse.json(data)
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'resource', entity_id: id, success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  const id = params.id
  try {
    const { data: row } = await supabase.from('resources').select('*').eq('id', id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Scope enforcement for non-yeshh
    try {
      const { data: adminRow } = await supabase.from('profiles').select('id,role').eq('email', admin.email).maybeSingle()
      if (adminRow && adminRow.role !== 'yeshh') {
        const { data: scopes } = await supabase
          .from('admin_scopes')
          .select('year,branch')
          .eq('admin_id', adminRow.id)
        const allowed = scopes && scopes.some((s: any) => s.year === row.year && s.branch === row.branch)
        if (!allowed) {
          return NextResponse.json({ error: 'Forbidden: outside your scope' }, { status: 403 })
        }
      }
    } catch {}
    let hardDeleted = false
    if (row.url) {
      try {
        const driveId = tryParseDriveIdFromUrl(row.url)
        const storage = tryParseStoragePathFromUrl(row.url)
        if (driveId) {
          const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'), scopes: ['https://www.googleapis.com/auth/drive'] })
          const drive = google.drive({ version: 'v3', auth })
          await drive.files.delete({ fileId: driveId })
        } else if (storage) {
          await supabase.storage.from(storage.bucket).remove([storage.path])
        }
        hardDeleted = true
      } catch (e) {
        hardDeleted = false
      }
    }

    if (hardDeleted) {
      const { error } = await supabase.from('resources').delete().eq('id', id)
      if (error) throw error
      await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'resource', entity_id: id })
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase.from('resources').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'soft_delete', entity: 'resource', entity_id: id, success: false, message: 'Blob deletion failed; soft-deleted row' })
    return NextResponse.json({ success: true, softDeleted: true })
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'resource', entity_id: id, success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 })
  }
}


