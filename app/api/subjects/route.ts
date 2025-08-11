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

    // Query offerings for given context
    const { data: offerings, error: offeringsError } = await supabase
      .from('subject_offerings')
      .select('subject_id, display_order, active')
      .eq('year', parseInt(year, 10))
      .eq('branch', branch)
      .eq('semester', parseInt(semester, 10))
      .eq('active', true)
      .order('display_order', { ascending: true })

    if (offeringsError) {
      return NextResponse.json({ error: 'Failed to load subject offerings' }, { status: 500 })
    }

    const subjectIds = (offerings || []).map((o) => o.subject_id)
    if (subjectIds.length === 0) {
      // Fallback: derive subjects from resources in the same context
      let resQuery = supabase
        .from('resources')
        .select('subject')
        .eq('year', parseInt(year, 10))
        .eq('branch', branch)
        .is('deleted_at', null)
      if (semester) resQuery = resQuery.eq('semester', parseInt(semester, 10))
      const { data: resSubjects, error: resErr } = await resQuery
      if (resErr) {
        return NextResponse.json({ subjects: [] })
      }
      const codes = Array.from(
        new Set((resSubjects || []).map((r: any) => String(r.subject || '').toLowerCase()).filter(Boolean))
      )
      if (codes.length === 0) return NextResponse.json({ subjects: [] })
      const { data: subjRows } = await supabase
        .from('subjects')
        .select('code,name')
        .in('code', codes)
      const codeToName: Record<string, string> = {}
      for (const s of subjRows || []) codeToName[String(s.code).toLowerCase()] = s.name as string
      const derived = codes.map((code) => ({ code, name: codeToName[code] || code.toUpperCase() }))
      return NextResponse.json({ subjects: derived })
    }

    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, code, name')
      .in('id', subjectIds)

    if (subjectsError) {
      return NextResponse.json({ error: 'Failed to load subjects' }, { status: 500 })
    }

    // Preserve display order using offerings order
    const idToSubject: Record<string, { id: string; code: string; name: string }> = {}
    for (const s of subjects || []) idToSubject[s.id] = s as any
    const ordered = (offerings || [])
      .map((o) => idToSubject[o.subject_id as string])
      .filter(Boolean)

    return NextResponse.json({ subjects: ordered })
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}


