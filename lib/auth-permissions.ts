import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'
import { UserRole, UserPermissions } from '@/lib/types'
import { UserContext, AdminContext, Representative, StudentWithRelations, RepresentativeWithRelations } from '@/lib/types/auth'

/**
 * Get the current user's context including their role and permissions
 */
export async function getCurrentUserContext(): Promise<UserContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const email = session.user.email.toLowerCase()
  const supabase = createSupabaseAdmin()

  // Get user role from profiles table (primary source of truth for roles)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .eq('email', email)
    .maybeSingle()

  if (profileError) {
    console.warn('Profile fetch error:', profileError)
    return null
  }

  if (!profile) {
    return null
  }

  // Get academic fields directly from profiles if present
  const { data: student, error: studentError } = await supabase
    .from('profiles')
    .select(`
      id,
      roll_number,
      name,
      email,
      branch_id,
      year_id,
      semester_id,
      section,
      branch:branches(id, name, code),
      year:years(id, batch_year, display_name),
      semester:semesters(id, semester_number)
    `)
    .eq('email', email)
    .maybeSingle()

  if (studentError) {
    console.warn('Student data fetch error:', studentError)
  }

  // If no student record exists, try to get academic data from profiles table as fallback
  let profileAcademicData = null
  if (!student && (profile.role === 'student' || profile.role === 'representative')) {
    const { data: fallbackProfile } = await supabase
      .from('profiles')
      .select('year, branch')
      .eq('email', email)
      .maybeSingle()

    if (fallbackProfile) {
      profileAcademicData = fallbackProfile
      console.log('Using profile fallback data for academic info:', profileAcademicData)
    }
  }

  // If user is a representative, get their representative assignments
  let representatives: RepresentativeWithRelations[] = []
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

    representatives = (repData as RepresentativeWithRelations[]) || []
  }

  // Transform representatives data for frontend with safe property access
  const representativeAssignments = representatives.map(rep => {
    // Log warnings for missing relations
    if (!rep.branches || rep.branches.length === 0) {
      console.warn('Representative assignment warning: Missing branch relation for rep', rep.id);
    }
    if (!rep.years || rep.years.length === 0) {
      console.warn('Representative assignment warning: Missing year relation for rep', rep.id);
    }

    return {
      branch_id: rep.branch_id,
      year_id: rep.year_id,
      branch_code: rep.branches?.[0]?.code || 'Unknown',
      admission_year: rep.years?.[0]?.batch_year || 0
    };
  })

  // Dynamic calculation of academic year level from batch year
  const calculateYearLevel = async (batchYear: number | undefined): Promise<number> => {
    if (!batchYear) return 1;
    // Simple fallback logic when academicConfig is not available
    const currentYear = new Date().getFullYear();
    if (batchYear > currentYear) return 1; // Future batch = freshman
    if (batchYear === currentYear) return 1; // Current batch = freshman
    if (batchYear === currentYear - 1) return 2; // Last year = sophomore
    if (batchYear === currentYear - 2) return 3; // Two years ago = junior
    return 4; // Older = senior/graduated
  }

  // Use profile data as primary source, with student data as fallback for academic info
  const userId = student?.id || profile.id;
  const userEmail = profile.email;
  const userName = student?.name || profile.name;
  const userRole = profile.role as UserRole;

  // Log warnings for missing student data if user should have it
  if (!student && (profile.role === 'student' || profile.role === 'representative')) {
    console.warn('Student context warning: No student record found for user with role', profile.role, profile.email);
  }

  const typedStudent = student as StudentWithRelations;

  // Log warnings for missing relations if student data exists
  if (typedStudent) {
    if (!typedStudent.branch || typedStudent.branch.length === 0) {
      console.warn('Student context warning: Missing branch relation for student', typedStudent.email);
    }
    if (!typedStudent.year || typedStudent.year.length === 0) {
      console.warn('Student context warning: Missing year relation for student', typedStudent.email);
    }
    if (!typedStudent.semester || typedStudent.semester.length === 0) {
      console.warn('Student context warning: Missing semester relation for student', typedStudent.email);
    }
  }

  // Get year and branch from student data or fallback to profile data
  let userYear: number | undefined
  let userBranch: string | undefined

  if (typedStudent?.year?.batch_year) {
    userYear = await calculateYearLevel(typedStudent.year.batch_year)
  } else if (profileAcademicData?.year) {
    userYear = profileAcademicData.year
  }

  if (typedStudent?.branch?.code) {
    userBranch = typedStudent.branch.code
  } else if (profileAcademicData?.branch) {
    userBranch = profileAcademicData.branch
  }

  return {
    id: userId,
    email: userEmail,
    name: userName,
    role: userRole,
    year: userYear,
    branch: userBranch,
    branchId: typedStudent?.branch_id,
    yearId: typedStudent?.year_id,
    semesterId: typedStudent?.semester_id,
    representatives,
    representativeAssignments
  }
}

/**
 * Check if current user has admin privileges
 */
export async function requireAdmin(minRole: 'admin' | 'yeshh' = 'admin'): Promise<AdminContext> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Error('Unauthorized')

  const email = session.user.email.toLowerCase()
  const supabase = createSupabaseAdmin()
  // Remove legacy admins table dependency if any stray usage remains
  // (no direct admins table read needed; roles come from profiles)
  // The following block is no longer needed as roles are directly from profiles
  // const { data, error } = await supabase
  //   .from('admins')
  //   .select('email, role')
  //   .eq('email', email)
  //   .maybeSingle()

  // if (error || !data) {
  //   // Dev-only fallback: allow AUTHORIZED_EMAILS as superadmin in development
  //   const isDev = process.env.NODE_ENV === 'development'
  //   const listFromServer = (process.env.AUTHORIZED_EMAILS || '')
  //     .split(',')
  //     .map((e) => e.trim().toLowerCase())
  //     .filter(Boolean)
  //   const isAuthorizedByEnv = listFromServer.includes(email)
  //   if (isDev && isAuthorizedByEnv) {
  //     console.warn('Development auth bypass:', {
  //       email,
  //       source: 'AUTHORIZED_EMAILS',
  //       role: 'superadmin',
  //       nodeEnv: process.env.NODE_ENV
  //     })
  //     return { email, role: 'superadmin' }
  //   }
  //   throw new Error('Forbidden')
  // }
  // if (minRole === 'superadmin' && data.role !== 'superadmin') throw new Error('Forbidden')
  // return { email: data.email, role: data.role as AdminContext['role'] }

  // Determine roles based on profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('email', email)
    .maybeSingle()

  if (profileError) {
    console.warn('Profile role fetch error:', profileError)
    throw new Error('Forbidden')
  }

  if (!profile) {
    throw new Error('Forbidden')
  }

  const userRole = profile.role as UserRole;

  if (minRole === 'yeshh' && userRole !== 'yeshh') {
    throw new Error('Forbidden')
  }

  return { email, role: userRole as AdminContext['role'] }
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
  if (!permissions) {
    throw new Error('Forbidden: Unable to determine permissions')
  }

  const permissionGroup = permissions[`can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof UserPermissions] as any
  const hasPermission = permissionGroup?.[entity]

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
