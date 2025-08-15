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
  // Parse and validate pagination parameters
  const rawPage = parseInt(url.searchParams.get('page') || '1', 10)
  const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10)
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 20
  
  // Validate sort and order parameters
  const allowedSort = ['due_date', 'title', 'created_at'] as const
  const allowedOrder = ['asc', 'desc'] as const
  const rawSort = url.searchParams.get('sort')
  const rawOrder = url.searchParams.get('order')
  const sort = (rawSort && allowedSort.includes(rawSort as any)) ? rawSort as typeof allowedSort[number] : 'due_date'
  const order = (rawOrder && allowedOrder.includes(rawOrder as any)) ? rawOrder as typeof allowedOrder[number] : 'asc'
  const from = (page - 1) * limit
  const to = from + limit - 1
  const status = url.searchParams.get('status')

  let query = supabase
    .from('reminders')
    .select('id,title,due_date,description,icon_type,status,year,branch', { count: 'exact' })
    .is('deleted_at', null)
    .order(sort, { ascending: order === 'asc' })

  if (status) query = query.eq('status', status)
  const year = toInt(url.searchParams.get('year'))
  if (year) query = query.eq('year', year)
  const branch = url.searchParams.get('branch')
  if (branch) query = query.eq('branch', branch)

  const { data, error, count } = await query.range(from, to)
  if (error) return NextResponse.json({ error: 'Failed to list reminders' }, { status: 500 })
  return NextResponse.json({ data, meta: { page, limit, count, totalPages: count ? Math.ceil(count / limit) : 1, sort, order } })
}

export async function POST(request: Request) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  try {
    const body = await request.json()
    const title = String(body.title || '').trim()
    const due_date = String(body.due_date || '').trim()
    if (!title || !due_date) return NextResponse.json({ error: 'title and due_date are required' }, { status: 400 })
    
    // Validate due_date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return NextResponse.json({ error: 'due_date must be in YYYY-MM-DD format' }, { status: 400 })
    }
    
    // Validate due_date is a real date
    const dateObj = new Date(due_date)
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'due_date must be a valid date' }, { status: 400 })
    }
    const payload = {
      title,
      due_date,
      description: body.description ? String(body.description) : null,
      icon_type: body.icon_type ? String(body.icon_type) : null,
      status: body.status ? String(body.status) : null,
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
    } catch (error) {
      console.error('Admin scope check failed:', error)
      await logAudit({ 
        actor_email: admin.email, 
        actor_role: admin.role, 
        action: 'create', 
        entity: 'reminder', 
        success: false, 
        message: `Scope check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      return NextResponse.json({ error: 'Forbidden: scope check failed' }, { status: 403 })
    }

    const { data, error } = await supabase.from('reminders').insert(payload).select('id').single()
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'reminder', entity_id: data.id, after_data: payload })
    return NextResponse.json({ id: data.id, ...payload })
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'reminder', success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 })
  }
}


