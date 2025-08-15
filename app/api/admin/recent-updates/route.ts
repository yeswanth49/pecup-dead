import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
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
  
  // Validate sort parameter
  const ALLOWED_SORTS = new Set(['created_at', 'date', 'title'])
  const sortParam = url.searchParams.get('sort')
  const sort = (sortParam && ALLOWED_SORTS.has(sortParam)) ? sortParam as 'created_at' | 'date' | 'title' : 'created_at'
  
  // Validate order parameter
  const ALLOWED_ORDERS = new Set(['asc', 'desc'])
  const orderParam = url.searchParams.get('order')
  const order = (orderParam && ALLOWED_ORDERS.has(orderParam)) ? orderParam as 'asc' | 'desc' : 'desc'
  
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('recent_updates')
    .select('id,title,date,description,year,branch,created_at', { count: 'exact' })
    .is('deleted_at', null)
    .order(sort, { ascending: order === 'asc' })

  const year = toInt(url.searchParams.get('year'))
  if (year) query = query.eq('year', year)
  const branch = url.searchParams.get('branch')
  if (branch) query = query.eq('branch', branch)

  const { data, error, count } = await query.range(from, to)
  if (error) return NextResponse.json({ error: 'Failed to list updates' }, { status: 500 })
  return NextResponse.json({ data, meta: { page, limit, count, totalPages: count ? Math.ceil(count / limit) : 1, sort, order } })
}

export async function POST(request: Request) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  try {
    const body = await request.json()
    const title = String(body.title || '')
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    const payload = {
      title,
      date: body.date ? String(body.date) : null,
      description: body.description ? String(body.description) : null,
      year: body.year ? toInt(body.year) : null,
      branch: body.branch || null,
    }
    // Scope enforcement (non-superadmin)
    try {
      const { data: adminRow } = await supabase.from('admins').select('id,role').eq('email', admin.email).maybeSingle()
      if (adminRow && adminRow.role !== 'superadmin') {
        const { data: scopes } = await supabase
          .from('admin_scopes')
          .select('year,branch')
          .eq('admin_id', adminRow.id)
        const allowed = scopes && scopes.some((s: any) => s.year === payload.year && s.branch === payload.branch)
        if (!allowed) return NextResponse.json({ error: 'Forbidden: outside your scope' }, { status: 403 })
      }
    } catch (scopeError) {
      console.error('Failed to validate admin scope:', scopeError)
      return NextResponse.json({ error: 'Internal error during authorization' }, { status: 500 })
    }

    const { data, error } = await supabase.from('recent_updates').insert(payload).select('id').single()
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'recent_update', entity_id: data.id, after_data: payload })
    return NextResponse.json({ id: data.id, ...payload })
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'recent_update', success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to create recent update' }, { status: 500 })
  }
}


