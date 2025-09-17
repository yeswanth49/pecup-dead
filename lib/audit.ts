import { createSupabaseAdmin } from '@/lib/supabase'

export async function logAudit(entry: {
  actor_email: string
  actor_role: 'admin' | 'yeshh'
  action: string
  entity: string
  entity_id?: string
  success?: boolean
  message?: string
  before_data?: unknown
  after_data?: unknown
}): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()
    const { error } = await supabase.from('audit_logs').insert({
      ...entry,
      success: entry.success ?? true,
    })
    
    if (error) {
      console.error('Audit log insertion failed:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Audit log insertion error:', error)
    return false
  }
}


