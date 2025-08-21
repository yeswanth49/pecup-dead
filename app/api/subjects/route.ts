import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = createSupabaseAdmin()
  const url = new URL(request.url)
  let year = url.searchParams.get('year')
  let branch = url.searchParams.get('branch')
  let semester = url.searchParams.get('semester')
  const resourceType = url.searchParams.get('resource_type') // 'resources', 'records', or null for all

  try {
    console.log(`[DEBUG] Initial params - year: ${year}, branch: ${branch}, semester: ${semester}`)
    
    // Infer from profile ONLY if not provided in URL
    if (!year || !branch || !semester) {
      const session = await getServerSession(authOptions)
      const email = session?.user?.email?.toLowerCase()
      console.log(`[DEBUG] User email: ${email}`)
      
      if (email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('year,branch')
          .eq('email', email)
          .maybeSingle()
        console.log(`[DEBUG] User profile:`, profile)
        
        if (profile) {
          year = year || String(profile.year)
          branch = branch || String(profile.branch)
        }
      }
      if (!semester) {
        // Approximate semester from current month if not provided
        const month = new Date().getMonth() // 0..11
        semester = month >= 7 ? '2' : '1'
      }
    }

    console.log(`[DEBUG] Final params - year: ${year}, branch: ${branch}, semester: ${semester}, resource_type: ${resourceType}`)

    if (!year || !branch || !semester) {
      return NextResponse.json({ error: 'Missing context (year/branch/semester).' }, { status: 400 })
    }

    // Try to get subjects from subject_offerings first (proper way)
    console.log(`[DEBUG] Subjects API - Looking for offerings: regulation=R23, year=${year}, branch=${branch}, semester=${semester}`)
    
    // Get subject_offerings first
    const { data: offeringsData, error: offeringsError } = await supabase
      .from('subject_offerings')
      .select('subject_id, display_order')
      .eq('regulation', 'R23')
      .eq('year', parseInt(year, 10))
      .eq('branch', branch)
      .eq('semester', parseInt(semester, 10))
      .eq('active', true)
      .order('display_order', { ascending: true })

    console.log(`[DEBUG] Subjects API - Found ${offeringsData?.length || 0} offerings:`, offeringsData)

    // Handle database query error
    if (offeringsError) {
      console.error(`[ERROR] Subjects API - Database error:`, offeringsError)
      return NextResponse.json({ 
        error: 'Database error occurred while fetching subjects',
        details: offeringsError.message 
      }, { status: 500 })
    }

    if (!offeringsData || offeringsData.length === 0) {
      console.log(`[DEBUG] Subjects API - No offerings found for context`)
      return NextResponse.json({ subjects: [] })
    }

    // Get subjects separately with resource_type filtering
    const subjectIds = offeringsData.map((offering: any) => offering.subject_id)
    let subjectsQuery = supabase
      .from('subjects')
      .select('id, code, name, resource_type')
      .in('id', subjectIds)
    
    // Apply resource_type filter if specified
    if (resourceType && (resourceType === 'resources' || resourceType === 'records')) {
      subjectsQuery = subjectsQuery.eq('resource_type', resourceType)
    }
    
    const { data: subjectsData, error: subjectsError } = await subjectsQuery

    if (subjectsError) {
      console.error(`[ERROR] Subjects API - Failed to fetch subjects:`, subjectsError)
      return NextResponse.json({ 
        error: 'Database error occurred while fetching subjects',
        details: subjectsError.message 
      }, { status: 500 })
    }

    // Map subjects back to offerings order
    const subjectMap = new Map(subjectsData?.map((s: any) => [s.id, s]) || [])
    const subjects = offeringsData
      .map((offering: any) => subjectMap.get(offering.subject_id))
      .filter(Boolean)
      .map((subject: any) => ({
        code: subject.code,
        name: subject.name,
        resource_type: subject.resource_type
      }))
    
    console.log(`[DEBUG] Subjects API - Returning ${subjects.length} subjects from offerings (filtered by resource_type: ${resourceType}):`, subjects)
    return NextResponse.json({ subjects })
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}


