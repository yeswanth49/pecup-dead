import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'
import { UserRole, UserPermissions, Representative } from '@/lib/types'

export interface UserContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  year?: number;
  branch?: string;
  branchId?: string;
  yearId?: string;
  semesterId?: string;
  representatives?: Representative[];
  representativeAssignments?: Array<{
    branch_id: string;
    year_id: string;
    branch_code: string;
    admission_year: number;
  }>;
}

export interface AdminContext {
  email: string;
  role: 'admin' | 'superadmin';
}

/**
 * Get the current user's context including their role and permissions
 */
export async function getCurrentUserContext(): Promise<UserContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const email = session.user.email.toLowerCase()
  const supabase = createSupabaseAdmin()

  // First check if user is in profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      name,
      role,
      year,
      branch
    `)
    .eq('email', email)
    .maybeSingle()

  if (profileError || !profile) {
    return null
  }

  // If user is a representative, get their representative assignments
  let representatives: Representative[] = []
  if (profile.role === 'representative') {
    const { data: repData } = await supabase
      .from('representatives')
      .select(`
        id,
        user_id,
        branch_id,
        year_id,
        assigned_by,
        assigned_at,
        active,
        branches:branch_id(id, name, code),
        years:year_id(id, batch_year, display_name)
      `)
      .eq('user_id', profile.id)
      .eq('active', true)

    representatives = repData || []
  }

  // Transform representatives data for frontend
  const representativeAssignments = representatives.map(rep => ({
    branch_id: rep.branch_id,
    year_id: rep.year_id,
    branch_code: (rep.branches as any)?.code || '',
    admission_year: (rep.years as any)?.batch_year || 0
  }))

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as UserRole,
    year: profile.year,
    branch: profile.branch,
    representatives,
    representativeAssignments
  }
}

/**
 * Check if current user has admin privileges
 */
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
    // Dev-only fallback: allow AUTHORIZED_EMAILS as superadmin in development
    const isDev = process.env.NODE_ENV === 'development'
    const listFromServer = (process.env.AUTHORIZED_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const isAuthorizedByEnv = listFromServer.includes(email)
    if (isDev && isAuthorizedByEnv) {
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
  return { email: data.email, role: data.role as AdminContext['role'] }
}

/**
 * Check if current user can manage resources for a specific branch and year
 */
export async function canManageResources(branchId: string, yearId: string): Promise<boolean> {
  const userContext = await getCurrentUserContext()
  if (!userContext) return false

  // Admins can manage all resources
  if (userContext.role === 'admin' || userContext.role === 'superadmin') {
    return true
  }

  // Representatives can manage resources for their assigned branch/year
  if (userContext.role === 'representative') {
    return userContext.representatives?.some(rep => 
      rep.branch_id === branchId && rep.year_id === yearId && rep.active
    ) || false
  }

  // Students cannot manage resources
  return false
}

/**
 * Check if current user can promote semester for a specific branch and year
 */
export async function canPromoteSemester(branchId: string, yearId: string): Promise<boolean> {
  const userContext = await getCurrentUserContext()
  if (!userContext) return false

  // Admins can promote any semester
  if (userContext.role === 'admin' || userContext.role === 'superadmin') {
    return true
  }

  // Representatives can promote semester for their assigned branch/year
  if (userContext.role === 'representative') {
    return userContext.representatives?.some(rep => 
      rep.branch_id === branchId && rep.year_id === yearId && rep.active
    ) || false
  }

  // Students cannot promote semesters
  return false
}

/**
 * Get user permissions based on their role and context
 */
export async function getUserPermissions(userContext?: UserContext): Promise<UserPermissions> {
  const context = userContext || await getCurrentUserContext()
  
  if (!context) {
    // No permissions for unauthenticated users
    return {
      canRead: {
        resources: false,
        reminders: false,
        recentUpdates: false,
        exams: false,
        profiles: false
      },
      canWrite: {
        resources: false,
        reminders: false,
        recentUpdates: false,
        exams: false,
        profiles: false
      },
      canDelete: {
        resources: false,
        reminders: false,
        recentUpdates: false,
        exams: false,
        profiles: false
      },
      canPromoteSemester: false
    }
  }

  switch (context.role) {
    case 'student':
      return {
        canRead: {
          resources: true,  // Filtered by their branch/year
          reminders: true,  // Filtered by their branch/year
          recentUpdates: true,  // Filtered by their branch/year
          exams: true,  // Filtered by their branch/year
          profiles: false  // Only their own profile
        },
        canWrite: {
          resources: false,
          reminders: false,
          recentUpdates: false,
          exams: false,
          profiles: false  // Only their own profile updates
        },
        canDelete: {
          resources: false,
          reminders: false,
          recentUpdates: false,
          exams: false,
          profiles: false
        },
        canPromoteSemester: false
      }

    case 'representative':
      return {
        canRead: {
          resources: true,
          reminders: true,
          recentUpdates: true,
          exams: true,
          profiles: false  // Only their own profile
        },
        canWrite: {
          resources: true,  // For their assigned branch/year
          reminders: true,  // For their assigned branch/year
          recentUpdates: true,  // For their assigned branch/year
          exams: true,  // For their assigned branch/year
          profiles: false  // Only their own profile updates
        },
        canDelete: {
          resources: true,  // For their assigned branch/year
          reminders: true,  // For their assigned branch/year
          recentUpdates: true,  // For their assigned branch/year
          exams: true,  // For their assigned branch/year
          profiles: false
        },
        canPromoteSemester: true,  // For their assigned branch/year
        scopeRestrictions: {
          branchIds: context.representatives?.map(rep => rep.branch_id) || [],
          yearIds: context.representatives?.map(rep => rep.year_id) || []
        }
      }

    case 'admin':
    case 'superadmin':
      return {
        canRead: {
          resources: true,
          reminders: true,
          recentUpdates: true,
          exams: true,
          profiles: true
        },
        canWrite: {
          resources: true,
          reminders: true,
          recentUpdates: true,
          exams: true,
          profiles: true
        },
        canDelete: {
          resources: true,
          reminders: true,
          recentUpdates: true,
          exams: true,
          profiles: true
        },
        canPromoteSemester: true
      }

    default:
      // Fallback to no permissions
      return {
        canRead: {
          resources: false,
          reminders: false,
          recentUpdates: false,
          exams: false,
          profiles: false
        },
        canWrite: {
          resources: false,
          reminders: false,
          recentUpdates: false,
          exams: false,
          profiles: false
        },
        canDelete: {
          resources: false,
          reminders: false,
          recentUpdates: false,
          exams: false,
          profiles: false
        },
        canPromoteSemester: false
      }
  }
}

/**
 * Require specific permission for an action
 */
export async function requirePermission(
  action: 'read' | 'write' | 'delete',
  entity: 'resources' | 'reminders' | 'recentUpdates' | 'exams' | 'profiles',
  branchId?: string,
  yearId?: string
): Promise<UserContext> {
  const userContext = await getCurrentUserContext()
  if (!userContext) throw new Error('Unauthorized')

  const permissions = await getUserPermissions(userContext)
  const hasPermission = permissions[`can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof UserPermissions][entity]

  if (!hasPermission) {
    throw new Error('Forbidden: Insufficient permissions')
  }

  // Additional scope check for representatives
  if (userContext.role === 'representative' && branchId && yearId) {
    const hasScope = userContext.representatives?.some(rep => 
      rep.branch_id === branchId && rep.year_id === yearId && rep.active
    )
    if (!hasScope) {
      throw new Error('Forbidden: Outside assigned scope')
    }
  }

  return userContext
}

/**
 * Check if user can assign representatives (admin only)
 */
export async function canAssignRepresentatives(): Promise<boolean> {
  try {
    await requireAdmin('admin')
    return true
  } catch {
    return false
  }
}

/**
 * Get filtered resources based on user role and permissions
 */
export function getResourceFilter(userContext: UserContext): {
  branchFilter?: string[];
  yearFilter?: string[];
  semesterFilter?: string[];
} {
  switch (userContext.role) {
    case 'student':
      // Students see only their branch and year
      return {
        branchFilter: userContext.branchId ? [userContext.branchId] : undefined,
        yearFilter: userContext.yearId ? [userContext.yearId] : undefined,
        semesterFilter: userContext.semesterId ? [userContext.semesterId] : undefined
      }

    case 'representative':
      // Representatives see resources for their assigned branches/years
      return {
        branchFilter: userContext.representatives?.map(rep => rep.branch_id) || [],
        yearFilter: userContext.representatives?.map(rep => rep.year_id) || []
      }

    case 'admin':
    case 'superadmin':
      // Admins see everything
      return {}

    default:
      // No access
      return {
        branchFilter: [],
        yearFilter: [],
        semesterFilter: []
      }
  }
}
