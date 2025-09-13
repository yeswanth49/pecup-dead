import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'

export type AdminContext = { email: string; role: 'admin' | 'superadmin' }

// Re-export from auth-permissions for backward compatibility
export { 
  getCurrentUserContext, 
  requirePermission, 
  canManageResources, 
  canPromoteSemester,
  getUserPermissions,
  canAssignRepresentatives
} from './auth-permissions'

export async function requireAdmin(minRole: 'admin' | 'superadmin' = 'admin'): Promise<AdminContext> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Error('Unauthorized')

  const email = session.user.email.toLowerCase()
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('email, role')
    .eq('email', email)
    .maybeSingle()

  if (error || !data) {
    // Dev-only fallback: allow AUTHORIZED_EMAILS as superadmin in development
    const isDev = process.env.NODE_ENV === 'development'
    const listFromServer = (process.env.AUTHORIZED_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const isAuthorizedByEnv = listFromServer.includes(email)
    if (isDev && isAuthorizedByEnv) {
      // Log the development-only authorization bypass
      console.warn('Development auth bypass:', {
        email,
        source: 'AUTHORIZED_EMAILS',
        role: 'superadmin',
        nodeEnv: process.env.NODE_ENV
      })
      return { email, role: 'superadmin' }
    }
    throw new Error('Forbidden')
  }
  if (minRole === 'superadmin' && data.role !== 'superadmin') throw new Error('Forbidden')
  if (data.role !== 'admin' && data.role !== 'superadmin') throw new Error('Forbidden')
  return { email: data.email, role: data.role as AdminContext['role'] }
}

export async function getSettings() {
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase.from('settings').select('*').single()
  if (error) throw error
  return data
}


