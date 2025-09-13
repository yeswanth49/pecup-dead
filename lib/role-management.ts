/**
 * Code-based role management utilities
 * Use these functions to assign roles programmatically
 */

import { createSupabaseAdmin } from '@/lib/supabase'
import { UserRole } from '@/lib/types'

/**
 * Assign a user as representative for specific branch/year combinations
 * This is the programmatic way to create representatives
 */
export async function assignRepresentative(
  userEmail: string,
  assignments: Array<{
    branchCode: string  // e.g., 'CSE', 'AIML'
    batchYear: number   // e.g., 2024, 2023
  }>
): Promise<{ success: boolean; error?: string; assignments?: any[] }> {
  const supabase = createSupabaseAdmin()

  try {
    // 1. Get the user
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('email', userEmail.toLowerCase())
      .single()

    if (userError || !user) {
      return { success: false, error: `User not found: ${userEmail}` }
    }

    // 2. Update user role to representative
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: 'representative' })
      .eq('id', user.id)

    if (roleError) {
      return { success: false, error: `Failed to update user role: ${roleError.message}` }
    }

    // 3. Create representative assignments
    const createdAssignments = []
    
    for (const assignment of assignments) {
      // Get branch ID
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id, code')
        .eq('code', assignment.branchCode)
        .single()

      if (branchError || !branch) {
        console.warn(`Branch not found: ${assignment.branchCode}`)
        continue
      }

      // Get year ID
      const { data: year, error: yearError } = await supabase
        .from('years')
        .select('id, batch_year')
        .eq('batch_year', assignment.batchYear)
        .single()

      if (yearError || !year) {
        console.warn(`Year not found: ${assignment.batchYear}`)
        continue
      }

      // Create representative assignment
      const { data: repAssignment, error: repError } = await supabase
        .from('representatives')
        .upsert({
          user_id: user.id,
          branch_id: branch.id,
          year_id: year.id,
          active: true
        })
        .select(`
          id,
          user_id,
          branch_id,
          year_id,
          active
        `)
        .single()

      if (!repError && repAssignment) {
        createdAssignments.push({
          ...repAssignment,
          branch_code: branch.code,
          batch_year: year.batch_year
        })
      }
    }

    console.log(`✅ Assigned ${user.email} as representative for:`)
    createdAssignments.forEach(assignment => {
      console.log(`   - ${assignment.branch_code} Year ${assignment.batch_year}`)
    })

    return { 
      success: true, 
      assignments: createdAssignments 
    }

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Remove representative role from a user
 */
export async function removeRepresentative(
  userEmail: string,
  removeAllAssignments: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdmin()

  try {
    // Get the user
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', userEmail.toLowerCase())
      .single()

    if (userError || !user) {
      return { success: false, error: `User not found: ${userEmail}` }
    }

    if (removeAllAssignments) {
      // Deactivate all representative assignments
      const { error: deactivateError } = await supabase
        .from('representatives')
        .update({ active: false })
        .eq('user_id', user.id)

      if (deactivateError) {
        return { success: false, error: `Failed to deactivate assignments: ${deactivateError.message}` }
      }

      // Change role back to student
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'student' })
        .eq('id', user.id)

      if (roleError) {
        return { success: false, error: `Failed to update user role: ${roleError.message}` }
      }
    }

    console.log(`✅ Removed representative role from ${user.email}`)
    return { success: true }

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Assign superadmin role to a user
 */
export async function assignSuperAdmin(userEmail: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdmin()

  try {
    // Check if user exists in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', userEmail.toLowerCase())
      .single()

    if (profileError || !profile) {
      return { success: false, error: `User profile not found: ${userEmail}` }
    }

    // Update profile role to superadmin
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ role: 'superadmin' })
      .eq('id', profile.id)

    if (profileUpdateError) {
      return { success: false, error: `Failed to update profile role: ${profileUpdateError.message}` }
    }

    // No admins table write; profiles.role is canonical

    console.log(`✅ Assigned superadmin role to ${userEmail}`)
    return { success: true }

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Assign admin role to a user
 */
export async function assignAdmin(userEmail: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdmin()

  try {
    // Check if user exists in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', userEmail.toLowerCase())
      .single()

    if (profileError || !profile) {
      return { success: false, error: `User profile not found: ${userEmail}` }
    }

    // Update profile role to admin
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', profile.id)

    if (profileUpdateError) {
      return { success: false, error: `Failed to update profile role: ${profileUpdateError.message}` }
    }

    // No admins table write; profiles.role is canonical

    console.log(`✅ Assigned admin role to ${userEmail}`)
    return { success: true }

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * List all representatives and their assignments
 */
export async function listRepresentatives(): Promise<any[]> {
  const supabase = createSupabaseAdmin()

  const { data: representatives, error } = await supabase
    .from('representatives')
    .select(`
      id,
      user_id,
      branch_id,
      year_id,
      active,
      assigned_at,
      profiles:user_id(email, name, roll_number),
      branches:branch_id(code, name),
      years:year_id(batch_year, display_name)
    `)
    .eq('active', true)
    .order('assigned_at', { ascending: false })

  if (error) {
    console.error('Error fetching representatives:', error)
    return []
  }

  return representatives || []
}

/**
 * Get user's current role and assignments
 */
export async function getUserRoleInfo(userEmail: string): Promise<{
  role: UserRole | null;
  assignments?: any[];
  error?: string;
}> {
  const supabase = createSupabaseAdmin()

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('email', userEmail.toLowerCase())
      .single()

    if (profileError || !profile) {
      return { role: null, error: `User not found: ${userEmail}` }
    }

    let assignments = []
    if (profile.role === 'representative') {
      const { data: repAssignments } = await supabase
        .from('representatives')
        .select(`
          id,
          branch_id,
          year_id,
          active,
          branches:branch_id(code, name),
          years:year_id(batch_year, display_name)
        `)
        .eq('user_id', profile.id)
        .eq('active', true)

      assignments = repAssignments || []
    }

    return {
      role: profile.role as UserRole,
      assignments
    }

  } catch (error) {
    return {
      role: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
