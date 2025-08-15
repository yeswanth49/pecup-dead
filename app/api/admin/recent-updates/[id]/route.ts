import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  const id = params.id
  
  // Validate ID parameter
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }
  
  try {
    const update = await request.json()
    const allowed = ['title', 'date', 'description', 'year', 'branch']
    const sanitized: Record<string, any> = {}
    for (const k of allowed) if (k in update) sanitized[k] = update[k]
    
    // Check if record exists before updating
    const { data: before, error: fetchError } = await supabase.from('recent_updates').select('*').eq('id', id).maybeSingle()
    if (fetchError) {
      throw fetchError
    }
    if (!before) {
      await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'recent_update', entity_id: id, success: false, message: 'Record not found' })
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    
    const { data, error } = await supabase.from('recent_updates').update(sanitized).eq('id', id).select('*').single()
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'recent_update', entity_id: id, before_data: before, after_data: data })
    return NextResponse.json(data)
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'recent_update', entity_id: id, success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to update recent update' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin('admin')
  const supabase = createSupabaseAdmin()
  const id = params.id
  
  // Validate ID parameter
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }
  
  try {
    // Check if record exists before deleting
    const { data: before } = await supabase.from('recent_updates').select('*').eq('id', id).maybeSingle()
    if (!before) {
      await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'recent_update', entity_id: id, success: false, message: 'Record not found' })
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    
    const { error } = await supabase.from('recent_updates').delete().eq('id', id)
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'recent_update', entity_id: id, before_data: before })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'recent_update', entity_id: id, success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to delete recent update' }, { status: 500 })
  }
}


