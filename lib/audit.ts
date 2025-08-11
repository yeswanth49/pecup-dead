import { createSupabaseAdmin } from '@/lib/supabase'

export async function logAudit(entry: {
  actor_email: string
  actor_role: 'admin' | 'superadmin'
  action: string
  entity: string
  entity_id?: string
  success?: boolean
  message?: string
  before_data?: unknown
  after_data?: unknown
}) {
  const supabase = createSupabaseAdmin()
  await supabase.from('audit_logs').insert({
    ...entry,
    success: entry.success ?? true,
  })
}


