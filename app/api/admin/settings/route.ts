import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admin = await requireAdmin('superadmin')
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase.from('settings').select('*').single()
    if (error) throw error

    await logAudit({
      actor_email: admin.email,
      actor_role: admin.role,
      action: 'read',
      entity: 'settings',
    })

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const admin = await requireAdmin('superadmin')
  const supabase = createSupabaseAdmin()

  try {
    const body = await request.json()
    const allowedKeys = ['drive_folder_id', 'storage_bucket', 'pdf_to_drive', 'non_pdf_to_storage']
    const update: Record<string, any> = {}
    for (const key of allowedKeys) if (key in body) update[key] = body[key]
    update.updated_at = new Date().toISOString()

    const { data: before } = await supabase.from('settings').select('*').single()
    const { data, error } = await supabase.from('settings').update(update).eq('id', true).select('*').single()
    if (error) throw error

    await logAudit({
      actor_email: admin.email,
      actor_role: admin.role,
      action: 'settings_update',
      entity: 'settings',
      before_data: before || null,
      after_data: data || null,
    })

    return NextResponse.json(data)
  } catch (err: any) {
    await logAudit({
      actor_email: admin.email,
      actor_role: admin.role,
      action: 'settings_update',
      entity: 'settings',
      success: false,
      message: err?.message || 'unknown',
    })
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}


