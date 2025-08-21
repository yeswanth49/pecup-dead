import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin, getCurrentUserContext, requirePermission } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

function toInt(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(request: Request) {
  // Allow admins and representatives
  const userContext = await getCurrentUserContext()
  if (!userContext || !['admin', 'superadmin', 'representative'].includes(userContext.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
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
  const userContext = await requirePermission('write', 'exams')
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
    // Scope enforcement for representatives
    if (userContext.role === 'representative') {
      // Representatives must specify branch and year, and it must be within their scope
      if (!payload.year || !payload.branch) {
        return NextResponse.json({ error: 'Representatives must specify year and branch' }, { status: 400 })
      }
      
      // Convert legacy year/branch to IDs for permission check
      const { data: branchData } = await supabase
        .from('branches')
        .select('id')
        .eq('code', payload.branch)
        .single()
      
      const { data: yearData } = await supabase
        .from('years')
        .select('id')
        .eq('batch_year', payload.year)
        .single()

      if (!branchData || !yearData) {
        return NextResponse.json({ error: 'Invalid branch or year' }, { status: 400 })
      }

      const canManage = userContext.representatives?.some(rep => 
        rep.branch_id === branchData.id && rep.year_id === yearData.id && rep.active
      )

      if (!canManage) {
        return NextResponse.json({ error: 'Forbidden: outside your assigned scope' }, { status: 403 })
      }
    }

    const { data, error } = await supabase.from('exams').insert(payload).select('id').single()
    if (error) throw error
    
    const auditRole = userContext.role === 'representative' ? 'admin' : userContext.role as 'admin' | 'superadmin'
    await logAudit({ 
      actor_email: userContext.email, 
      actor_role: auditRole, 
      action: 'create', 
      entity: 'exam', 
      entity_id: data.id, 
      after_data: payload 
    })
    return NextResponse.json({ id: data.id, ...payload })
  } catch (err: any) {
    const auditRole = userContext.role === 'representative' ? 'admin' : userContext.role as 'admin' | 'superadmin'
    await logAudit({ 
      actor_email: userContext.email, 
      actor_role: auditRole, 
      action: 'create', 
      entity: 'exam', 
      success: false, 
      message: err?.message 
    })
    return NextResponse.json({ error: 'Failed to create exam' }, { status: 500 })
  }
}


