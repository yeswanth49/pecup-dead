import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin, getSettings } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { validateFile, getFileExtension } from '@/lib/file-validation'
import { tryParseDriveIdFromUrl, tryParseStoragePathFromUrl } from '@/lib/files'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

type Branch = 'CSE'|'AIML'|'DS'|'AI'|'ECE'|'EEE'|'MEC'|'CE'

function toInt(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(request: Request) {
  // Require admin; in development, fall back to allowing access so lists can load
  try {
    await requireAdmin('admin')
  } catch (err) {
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  const supabase = createSupabaseAdmin()
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  // Allow larger caps in dev to fetch all resources
  const limitCap = process.env.NODE_ENV === 'development' ? 1000 : 200
  const limit = Math.min(limitCap, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
  const sort = (url.searchParams.get('sort') || 'date') as 'date' | 'name' | 'created_at'
  const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc'
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('resources')
    .select('id,name,category,subject,unit,type,date,is_pdf,url,year,branch,archived,semester', { count: 'exact' })
    .order(sort, { ascending: order === 'asc' })

  // Optional filters
  const subject = url.searchParams.get('subject')
  if (subject) query = query.ilike('subject', `%${subject}%`)
  const category = url.searchParams.get('category')
  if (category) query = query.eq('category', category)
  const unit = toInt(url.searchParams.get('unit'))
  if (unit !== null) query = query.eq('unit', unit)
  const year = toInt(url.searchParams.get('year'))
  if (year !== null) query = query.eq('year', year)
  const semester = toInt(url.searchParams.get('semester'))
  if (semester !== null) query = query.eq('semester', semester)
  const branch = url.searchParams.get('branch')
  if (branch) query = query.eq('branch', branch)
  const archivedParam = url.searchParams.get('archived')
  if (archivedParam === 'true') query = query.eq('archived', true)
  if (archivedParam === 'false') query = query.eq('archived', false)

  // Enforce admin scope: if admin_scopes exist for this user, limit results
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email?.toLowerCase()
    if (email) {
      const { data: adminRow } = await supabase
        .from('admins')
        .select('id,role')
        .eq('email', email)
        .maybeSingle()
      if (adminRow && adminRow.role !== 'superadmin') {
        const { data: scopes } = await supabase
          .from('admin_scopes')
          .select('year,branch')
          .eq('admin_id', adminRow.id)
        if (scopes && scopes.length > 0) {
          // If filters already set, they further narrow; otherwise apply in() clauses
          const years = [...new Set(scopes.map((s: any) => s.year))]
          const branches = [...new Set(scopes.map((s: any) => s.branch))]
          if (year === null) query = query.in('year', years)
          if (!branch) query = query.in('branch', branches)
        }
      }
    }
  } catch {}

  const { data, error, count } = await query.range(from, to)
  if (error) {
    console.error('Admin resources list error:', error)
    // Return an empty list instead of failing the UI in development
    return NextResponse.json({ data: [], meta: { page, limit, count: 0, totalPages: 1, sort, order }, warning: 'Failed to list resources' })
  }
  return NextResponse.json({ data, meta: { page, limit, count, totalPages: count ? Math.ceil(count / limit) : 1, sort, order } })
}

async function uploadToDrive(fileBuffer: Buffer, fileName: string, mime: string, description?: string) {
  const settings = await getSettings()
  const driveFolderId = settings?.drive_folder_id || process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!driveFolderId) throw new Error('Drive folder id not configured')
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}')
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] })
  const drive = google.drive({ version: 'v3', auth })
  const fileReadable = Readable.from(fileBuffer)
  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [driveFolderId], description },
    media: { mimeType: mime || 'application/pdf', body: fileReadable },
    fields: 'id,webViewLink',
  })
  if (!data.id) throw new Error('Drive upload failed')
  await drive.permissions.create({ fileId: data.id, requestBody: { role: 'reader', type: 'anyone' } })
  const url = data.webViewLink || `https://drive.google.com/file/d/${data.id}/view?usp=sharing`
  return { url }
}

async function uploadToStorage(fileBuffer: Buffer, fileName: string, mime?: string) {
  const settings = await getSettings()
  const bucket = settings?.storage_bucket || 'resources'
  const supabase = createSupabaseAdmin()
  const uploadPath = `${Date.now()}-${fileName}`
  const { error } = await supabase.storage.from(bucket).upload(uploadPath, fileBuffer, { contentType: mime || undefined, duplex: 'half' as any })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
  return { url: data.publicUrl }
}

export async function POST(request: Request) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  const contentType = request.headers.get('content-type') || ''

  try {
    let payload: any = {}
    let file: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const required = ['category', 'subject', 'unit', 'name'] as const
      for (const k of form.keys()) payload[k] = form.get(k)
      for (const k of required) if (!payload[k]) return NextResponse.json({ error: `Missing field ${k}` }, { status: 400 })
      file = (form.get('file') as unknown as File) || null
    } else {
      payload = await request.json()
      const required = ['category', 'subject', 'unit', 'name'] as const
      for (const k of required) if (!payload[k]) return NextResponse.json({ error: `Missing field ${k}` }, { status: 400 })
    }

    const unit = toInt(payload.unit)
    if (!unit || unit < 1) return NextResponse.json({ error: 'Invalid unit' }, { status: 400 })

    let url: string | undefined
    let is_pdf = false

    if (file) {
      const originalName = (file as any).name as string
      const clientMime = (file as any).type as string | undefined
      const size = (file as any).size as number | undefined
      if (typeof size === 'number' && size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 413 })
      const buffer = Buffer.from(await file.arrayBuffer())
      const validation = validateFile(buffer, originalName, clientMime)
      if (!validation.ok) return NextResponse.json({ error: 'Unsupported file type', reason: validation.reason }, { status: 415 })
      const effectiveMime = (validation.detectedMime || clientMime || '').toLowerCase()
      is_pdf = effectiveMime === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')

      const settings = await getSettings()
      if (is_pdf && settings?.pdf_to_drive) {
        const uploaded = await uploadToDrive(buffer, originalName, effectiveMime, payload.description || undefined)
        url = uploaded.url
      } else {
        const uploaded = await uploadToStorage(buffer, originalName, effectiveMime)
        url = uploaded.url
      }
    } else if (payload.url) {
      url = String(payload.url)
      is_pdf = url.toLowerCase().includes('drive.google.com') || url.toLowerCase().endsWith('.pdf')
    } else {
      return NextResponse.json({ error: 'Either file or url is required' }, { status: 400 })
    }

    const insertPayload = {
      category: String(payload.category),
      subject: String(payload.subject).toLowerCase(),
      unit,
      name: String(payload.name),
      description: payload.description ? String(payload.description) : null,
      type: payload.type ? String(payload.type) : null,
      year: payload.year ? toInt(payload.year) : null,
      branch: payload.branch || null,
      archived: Boolean(payload.archived) || false,
      semester: payload.semester ? toInt(payload.semester) : null,
      url: url!,
      is_pdf,
    }

    // Enforce scope for non-superadmin: require year+branch be within admin_scopes
    try {
      const { data: adminRow } = await supabase.from('admins').select('id,role').eq('email', admin.email).maybeSingle()
      if (adminRow && adminRow.role !== 'superadmin') {
        const { data: scopes } = await supabase
          .from('admin_scopes')
          .select('year,branch')
          .eq('admin_id', adminRow.id)
        if (!scopes || scopes.length === 0) {
          return NextResponse.json({ error: 'Forbidden: no scope assigned' }, { status: 403 })
        }
        const allowed = scopes.some((s: any) => s.year === insertPayload.year && s.branch === insertPayload.branch)
        if (!allowed) {
          return NextResponse.json({ error: 'Forbidden: outside your assigned year/branch' }, { status: 403 })
        }
      }
    } catch {}

    const { data, error } = await supabase.from('resources').insert(insertPayload).select('id').single()
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'resource', entity_id: data.id, after_data: insertPayload })
    return NextResponse.json({ id: data.id, ...insertPayload })
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'resource', success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
  }
}


