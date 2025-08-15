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

  try {
    // Infer from profile if not provided
    if (!year || !branch || !semester) {
      const session = await getServerSession(authOptions)
      const email = session?.user?.email?.toLowerCase()
      if (email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('year,branch')
          .eq('email', email)
          .maybeSingle()
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

    if (!year || !branch || !semester) {
      return NextResponse.json({ error: 'Missing context (year/branch/semester).' }, { status: 400 })
    }

    // Try to get subjects from subject_offerings first (proper way)
    console.log(`[DEBUG] Subjects API - Looking for offerings: regulation=R23, year=${year}, branch=${branch}, semester=${semester}`)
    
    const { data: offerings, error: offeringsError } = await supabase
      .from('subject_offerings')
      .select(`
        subject_id,
        display_order,
        active,
        subjects (
          id,
          code,
          name
        )
      `)
      .eq('regulation', 'R23')
      .eq('year', parseInt(year, 10))
      .eq('branch', branch)
      .eq('semester', parseInt(semester, 10))
      .eq('active', true)
      .order('display_order', { ascending: true })

    console.log(`[DEBUG] Subjects API - Found ${offerings?.length || 0} offerings:`, offerings)

    // If subject_offerings works, use that
    if (!offeringsError && offerings && offerings.length > 0) {
      const subjects = offerings
        .map((offering: any) => offering.subjects)
        .filter(Boolean)
        .map((subject: any) => ({
          code: subject.code,
          name: subject.name
        }))
      
      console.log(`[DEBUG] Subjects API - Returning ${subjects.length} subjects from offerings:`, subjects)
      return NextResponse.json({ subjects })
    }

    // Fallback to resources if subject_offerings table doesn't exist or has no data
    console.log(`[DEBUG] Subjects API - No offerings found (${offeringsError?.message || 'empty'}), falling back to resources...`)
    
    let resQuery = supabase
      .from('resources')
      .select('subject')
      .eq('year', parseInt(year, 10))
      .eq('branch', branch)
      .is('deleted_at', null)
    if (semester) resQuery = resQuery.eq('semester', parseInt(semester, 10))
    
    const { data: resSubjects, error: resErr } = await resQuery
    console.log(`[DEBUG] Subjects API - Found ${resSubjects?.length || 0} resources`)
    
    if (resErr) {
      return NextResponse.json({ subjects: [] })
    }
    
    const codes = Array.from(
      new Set((resSubjects || []).map((r: any) => String(r.subject || '').toLowerCase()).filter(Boolean))
    )
    
    if (codes.length === 0) {
      return NextResponse.json({ subjects: [] })
    }
    
    // Create subject objects from the resource data
    const subjects = codes.map((code) => ({ 
      code, 
      name: code.toUpperCase().replace(/_/g, ' ')
    }))
    
    console.log(`[DEBUG] Subjects API - Returning ${subjects.length} subjects from resources:`, subjects)
    return NextResponse.json({ subjects })
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}


