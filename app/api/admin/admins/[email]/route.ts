import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function PATCH(_request: Request, { params }: { params: { email: string } }) {
  const admin = await requireAdmin('superadmin')
  const supabase = createSupabaseAdmin()
  try {
    const email = decodeURIComponent(params.email).toLowerCase()
    const body = await _request.json()
    const role = String(body.role || '')
    if (!['admin', 'superadmin'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    // Check if admin exists before updating
    const { data: existingAdmin } = await supabase.from('admins').select('id,email,role,created_at').eq('email', email).maybeSingle()
    if (!existingAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('admins')
      .update({ role })
      .eq('email', email)
      .select('id,email,role,created_at')
      .single()
    if (error) throw error
    
    // Validate that update actually succeeded
    if (!data) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }
    
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'admin', entity_id: data.id, before_data: existingAdmin, after_data: data })
    return NextResponse.json(data)
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'update', entity: 'admin', success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to update admin role' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { email: string } }) {
  const admin = await requireAdmin('superadmin')
  const supabase = createSupabaseAdmin()
  try {
    const email = decodeURIComponent(params.email).toLowerCase()
    
    // Check if admin exists before deleting
    const { data: before } = await supabase.from('admins').select('id,email,role,created_at').eq('email', email).maybeSingle()
    if (!before) {
      await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'admin', success: false, message: 'Admin not found' })
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }
    
    const { error } = await supabase.from('admins').delete().eq('email', email)
    if (error) throw error
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'admin', entity_id: before.id, before_data: before })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    await logAudit({ actor_email: admin.email, actor_role: admin.role, action: 'delete', entity: 'admin', success: false, message: err?.message })
    return NextResponse.json({ error: 'Failed to remove admin' }, { status: 500 })
  }
}


