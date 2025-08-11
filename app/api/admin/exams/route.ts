import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

function toInt(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(request: Request) {
  await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
  const sort = (url.searchParams.get('sort') || 'exam_date') as 'exam_date' | 'subject' | 'created_at'
  const order = (url.searchParams.get('order') || 'asc') as 'asc' | 'desc'
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('exams')
    .select('id,subject,exam_date,description,year,branch', { count: 'exact' })
    .is('deleted_at', null)
    .order(sort, { ascending: order === 'asc' })

  const year = toInt(url.searchParams.get('year'))
  if (year) query = query.eq('year', year)
  const branch = url.searchParams.get('branch')
  if (branch) query = query.eq('branch', branch)

  const { data, error, count } = await query.range(from, to)
  if (error) return NextResponse.json({ error: 'Failed to list exams' }, { status: 500 })
  return NextResponse.json({ data, meta: { page, limit, count, totalPages: count ? Math.ceil(count / limit) : 1, sort, order } })
}

export async function POST(request: Request) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  try {
    const body = await request.json()
    const subject = String(body.subject || '')
    const exam_date = String(body.exam_date || '')
    if (!subject || !exam_date) return NextResponse.json({ error: 'subject and exam_date are required' }, { status: 400 })
    const payload = {
      subject,
      exam_date,
      description: body.description ? String(body.description) : null,
      year: body.year ? toInt(body.year) : null,
      branch: body.branch || null,
    }
    const { data, error } = await supabase.from('exams').insert(payload).select('id').single()
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'exam', entity_id: data.id, after_data: payload })
    return NextResponse.json({ id: data.id, ...payload })
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'exam', success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to create exam' }, { status: 500 })
  }
}


