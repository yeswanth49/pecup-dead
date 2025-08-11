import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'

export type AdminContext = { email: string; role: 'admin' | 'superadmin' }

export async function requireAdmin(minRole: 'admin' | 'superadmin' = 'admin'): Promise<AdminContext> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Error('Unauthorized')

  const email = session.user.email.toLowerCase()
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('admins')
    .select('email, role')
    .eq('email', email)
    .maybeSingle()

  if (error || !data) {
    // Dev-only fallback: allow NEXT_PUBLIC_AUTHORIZED_EMAILS or AUTHORIZED_EMAILS as superadmin in development
    const isDev = process.env.NODE_ENV === 'development'
    const listFromPublic = (process.env.NEXT_PUBLIC_AUTHORIZED_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const listFromServer = (process.env.AUTHORIZED_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const isAuthorizedByEnv = [...listFromPublic, ...listFromServer].includes(email)
    if (isDev && isAuthorizedByEnv) {
      return { email, role: 'superadmin' }
    }
    throw new Error('Forbidden')
  }
  if (minRole === 'superadmin' && data.role !== 'superadmin') throw new Error('Forbidden')
  return { email: data.email, role: data.role as AdminContext['role'] }
}

export async function getSettings() {
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase.from('settings').select('*').single()
  if (error) throw error
  return data
}


