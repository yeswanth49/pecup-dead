import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  const id = params.id
  try {
    const update = await request.json()
    const allowed = ['title', 'due_date', 'description', 'icon_type', 'status', 'year', 'branch']
    const sanitized: Record<string, any> = {}
    for (const k of allowed) if (k in update) sanitized[k] = update[k]
    const { data: before } = await supabase.from('reminders').select('*').eq('id', id).maybeSingle()
    const { data, error } = await supabase.from('reminders').update(sanitized).eq('id', id).select('*').maybeSingle()
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'reminder', entity_id: id, before_data: before, after_data: data })
    return NextResponse.json(data)
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'reminder', entity_id: id, success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  const id = params.id
  try {
    const { data: before } = await supabase.from('reminders').select('*').eq('id', id).maybeSingle()
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'reminder', entity_id: id, before_data: before })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'reminder', entity_id: id, success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 })
  }
}


