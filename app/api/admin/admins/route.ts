import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    await requireAdmin('superadmin')
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Admin auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
  const supabase = createSupabaseAdmin()
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const sort = (url.searchParams.get('sort') || 'created_at') as 'created_at' | 'email' | 'role'
  const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc'

  const { data, error, count } = await supabase
    .from('profiles')
    .select('id,email,role,created_at', { count: 'exact' })
    .in('role', ['admin', 'superadmin'])
    .order(sort, { ascending: order === 'asc' })
    .range(from, to)

  if (error) return NextResponse.json({ error: 'Failed to list admins' }, { status: 500 })
  return NextResponse.json({ data, meta: { page, limit, count, totalPages: count ? Math.ceil(count / limit) : 1, sort, order } })
}

export async function POST(request: Request) {
  let admin
  try {
    admin = await requireAdmin('superadmin')
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Admin auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
  const supabase = createSupabaseAdmin()
  try {
    const body = await request.json()
    const email = String(body.email || '').toLowerCase()
    const role = String(body.role || 'admin')
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    if (!['admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Ensure profile exists, then set role
    const { data: existing } = await supabase.from('profiles').select('id,email,role,created_at').eq('email', email).maybeSingle()
    let data
    if (existing) {
      const upd = await supabase.from('profiles').update({ role }).eq('email', email).select('id,email,role,created_at').single()
      if (upd.error) throw upd.error
      data = upd.data
    } else {
      const ins = await supabase.from('profiles').insert({ email, role }).select('id,email,role,created_at').single()
      if (ins.error) throw ins.error
      data = ins.data
    }

    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'admin', entity_id: data.id, after_data: data })
    return NextResponse.json(data)
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'create', entity: 'admin', success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to add admin' }, { status: 500 })
  }
}


