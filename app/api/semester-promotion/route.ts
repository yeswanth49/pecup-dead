import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserContext, canPromoteSemester } from '@/lib/auth-permissions'
import { createSupabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/semester-promotion
 * Promote students from current semester to next semester
 * Available to representatives (for their assigned branch/year) and admins
 */
export async function POST(request: NextRequest) {
  try {
    const userContext = await getCurrentUserContext()
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { branchId, yearId, fromSemesterId, toSemesterId, notes } = body

    if (!branchId || !yearId || !fromSemesterId || !toSemesterId) {
      return NextResponse.json(
        { error: 'Missing required fields: branchId, yearId, fromSemesterId, toSemesterId' },
        { status: 400 }
      )
    }

    // Check if user has permission to promote for this branch/year
    const canPromote = await canPromoteSemester(branchId, yearId)
    if (!canPromote) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot promote semester for this branch/year' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Validate that the semesters exist and are sequential
    const { data: fromSemester } = await supabase
      .from('semesters')
      .select('id, semester_number, year_id')
      .eq('id', fromSemesterId)
      .single()

    const { data: toSemester } = await supabase
      .from('semesters')
      .select('id, semester_number, year_id')
      .eq('id', toSemesterId)
      .single()

    if (!fromSemester || !toSemester) {
      return NextResponse.json({ error: 'Invalid semester IDs' }, { status: 400 })
    }

    // Validate that we're promoting to the next logical semester
    const isValidPromotion = 
      (fromSemester.semester_number === 1 && toSemester.semester_number === 2 && fromSemester.year_id === toSemester.year_id) ||
      (fromSemester.semester_number === 2 && toSemester.semester_number === 1 && fromSemester.year_id !== toSemester.year_id)

    if (!isValidPromotion) {
      return NextResponse.json(
        { error: 'Invalid semester promotion: must be sequential (1->2 same year, or 2->1 next year)' },
        { status: 400 }
      )
    }

    // Get students to promote
    const { data: studentsToPromote, error: studentsError } = await supabase
      .from('students')
      .select('id, roll_number, name, email')
      .eq('branch_id', branchId)
      .eq('year_id', yearId)
      .eq('semester_id', fromSemesterId)

    if (studentsError) {
      console.error('Error fetching students to promote:', studentsError)
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
    }

    if (!studentsToPromote || studentsToPromote.length === 0) {
      return NextResponse.json(
        { error: 'No students found for promotion in the specified criteria' },
        { status: 404 }
      )
    }

    // Update students' semester
    const { error: updateError } = await supabase
      .from('students')
      .update({ 
        semester_id: toSemesterId,
        ...(toSemester.year_id !== fromSemester.year_id ? { year_id: toSemester.year_id } : {})
      })
      .eq('branch_id', branchId)
      .eq('year_id', yearId)
      .eq('semester_id', fromSemesterId)

    if (updateError) {
      console.error('Error promoting students:', updateError)
      return NextResponse.json({ error: 'Failed to promote students' }, { status: 500 })
    }

    // Record the promotion
    const { data: promotion, error: promotionError } = await supabase
      .from('semester_promotions')
      .insert({
        promoted_by: userContext.id,
        from_semester_id: fromSemesterId,
        to_semester_id: toSemesterId,
        branch_id: branchId,
        year_id: yearId,
        notes: notes || null
      })
      .select('id')
      .single()

    if (promotionError) {
      console.error('Error recording promotion:', promotionError)
      // Don't fail the request, just log the issue
    }

    // Log the promotion action
    await logAudit({
      actorEmail: userContext.email,
      actorRole: userContext.role === 'representative' ? 'admin' : userContext.role as any,
      action: 'promote_semester',
      entity: 'semester_promotions',
      entityId: promotion?.id || 'unknown',
      success: true,
      message: `Promoted ${studentsToPromote.length} students from semester ${fromSemester.semester_number} to ${toSemester.semester_number}`,
      afterData: {
        branchId,
        yearId,
        fromSemesterId,
        toSemesterId,
        studentsCount: studentsToPromote.length,
        notes
      }
    })

    return NextResponse.json({
      success: true,
      promotedCount: studentsToPromote.length,
      promotion: promotion
    })
  } catch (error) {
    console.error('Semester promotion error:', error)
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/semester-promotion
 * Get promotion history (for admins and representatives to see their actions)
 */
export async function GET(request: NextRequest) {
  try {
    const userContext = await getCurrentUserContext()
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const url = new URL(request.url)
    const branchId = url.searchParams.get('branchId')
    const yearId = url.searchParams.get('yearId')

    let query = supabase
      .from('semester_promotions')
      .select(`
        id,
        promoted_by,
        from_semester_id,
        to_semester_id,
        branch_id,
        year_id,
        promotion_date,
        notes,
        created_at,
        profiles:promoted_by(id, email, name, role),
        from_semester:from_semester_id(id, semester_number),
        to_semester:to_semester_id(id, semester_number),
        branches:branch_id(id, name, code),
        years:year_id(id, batch_year, display_name)
      `)
      .order('promotion_date', { ascending: false })

    // Filter based on user role
    if (userContext.role === 'representative') {
      // Representatives can only see promotions for their assigned branches/years
      const assignedBranchIds = userContext.representatives?.map(rep => rep.branch_id) || []
      const assignedYearIds = userContext.representatives?.map(rep => rep.year_id) || []
      
      if (assignedBranchIds.length > 0) {
        query = query.in('branch_id', assignedBranchIds)
      }
      if (assignedYearIds.length > 0) {
        query = query.in('year_id', assignedYearIds)
      }
    } else if (userContext.role === 'student') {
      // Students cannot view promotion history
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Apply additional filters if provided
    if (branchId) query = query.eq('branch_id', branchId)
    if (yearId) query = query.eq('year_id', yearId)

    const { data: promotions, error } = await query

    if (error) {
      console.error('Error fetching promotions:', error)
      return NextResponse.json({ error: 'Failed to fetch promotions' }, { status: 500 })
    }

    return NextResponse.json({ promotions })
  } catch (error) {
    console.error('Promotion history GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
