import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'
import { AcademicConfigManager } from '@/lib/academic-config'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    const supabase = createSupabaseAdmin()
    const academicConfig = AcademicConfigManager.getInstance()

    // Fetch profile with relations
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select(`
        id, roll_number, name, email, branch_id, year_id, semester_id, section, role,
        branch:branches(id, name, code),
        year:years(id, batch_year, display_name),
        semester:semesters(id, semester_number)
      `)
      .eq('email', email)
      .maybeSingle()

    if (profileErr) {
      console.error('[bulk] profile query error:', profileErr)
      return NextResponse.json({ error: 'Database error loading profile' }, { status: 500 })
    }
    if (!profileRow) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const currentYear = profileRow.year?.batch_year
      ? await academicConfig.calculateAcademicYear(profileRow.year.batch_year)
      : null
    const branchCode = profileRow.branch?.code || null
    const semesterNumber = profileRow.semester?.semester_number || null

    // Defensive: If missing critical context, advise re-auth workflow in message
    const contextWarnings: string[] = []
    if (!branchCode || !currentYear || !semesterNumber) {
      contextWarnings.push('Missing branch/year/semester context. If this persists, please log out and log in again to refresh your profile data.')
    }

    // Fetch subjects using subject_offerings with dynamic regulation (do not hardcode)
    const subjectsPromise = (async () => {
      if (!branchCode || !currentYear || !semesterNumber) return { data: [] as any[] }

      // Try to detect latest regulation from offerings for this context, fall back to most recent by created_at
      const { data: regs } = await supabase
        .from('subject_offerings')
        .select('regulation')
        .eq('branch', branchCode)
        .eq('year', currentYear)
        .eq('semester', semesterNumber)
        .eq('active', true)
        .order('regulation', { ascending: false })
        .limit(1)

      const regulation = regs && regs.length > 0 ? regs[0].regulation : null

      let offeringsQuery = supabase
        .from('subject_offerings')
        .select('subject_id, display_order')
        .eq('branch', branchCode)
        .eq('year', currentYear)
        .eq('semester', semesterNumber)
        .eq('active', true)
        .order('display_order', { ascending: true })

      if (regulation) {
        offeringsQuery = offeringsQuery.eq('regulation', regulation)
      }

      const { data: offerings, error: offeringsErr } = await offeringsQuery
      if (offeringsErr) {
        console.error('[bulk] offerings query error:', offeringsErr)
        return { data: [] as any[] }
      }
      if (!offerings || offerings.length === 0) return { data: [] as any[] }

      const subjectIds = offerings.map(o => o.subject_id)
      const { data: subjects, error: subjectsErr } = await supabase
        .from('subjects')
        .select('id, code, name, resource_type')
        .in('id', subjectIds)
      if (subjectsErr) {
        console.error('[bulk] subjects query error:', subjectsErr)
        return { data: [] as any[] }
      }
      // Sort by display_order using offerings order mapping
      const orderMap = new Map<string, number>(offerings.map(o => [o.subject_id, o.display_order ?? 0]))
      const sorted = (subjects || []).slice().sort((a: any, b: any) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
      return { data: sorted }
    })()

    // Static data
    const staticPromise = Promise.all([
      supabase.from('branches').select('*'),
      supabase.from('years').select('*'),
      supabase.from('semesters').select('*')
    ])

    // Dynamic data
    const dynamicPromise = (async () => {
      // Dates for exams window
      const start = new Date()
      start.setUTCHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 5)
      const startDateStr = start.toISOString().slice(0, 10)
      const endDateStr = end.toISOString().slice(0, 10)

      // recent_updates: filter by context when available; else return latest
      let recentUpdatesQuery = supabase
        .from('recent_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      if (branchCode && currentYear) {
        recentUpdatesQuery = recentUpdatesQuery.eq('branch', branchCode).eq('year', currentYear)
      }

      // exams: filter by branch/year when available, then by date window
      let examsQuery = supabase
        .from('exams')
        .select('subject, exam_date, year, branch')
        .gte('exam_date', startDateStr)
        .lte('exam_date', endDateStr)
        .order('exam_date', { ascending: true })
      if (branchCode) examsQuery = examsQuery.eq('branch', branchCode)
      if (currentYear) examsQuery = examsQuery.eq('year', currentYear)

      // reminders: filter by context when available; else return latest upcoming by due_date
      let remindersQuery = supabase
        .from('reminders')
        .select('*')
        .is('deleted_at', null)
        .gte('due_date', startDateStr)
        .order('due_date', { ascending: true })
        .limit(5)
      if (branchCode && currentYear) {
        remindersQuery = remindersQuery.eq('branch', branchCode).eq('year', currentYear)
      }

      const [recentUpdates, upcomingExams, upcomingReminders] = await Promise.all([
        recentUpdatesQuery,
        examsQuery,
        remindersQuery
      ])

      return { recentUpdates, upcomingExams, upcomingReminders }
    })()

    const [subjectsResult, staticResults, dynamicResults] = await Promise.all([
      subjectsPromise,
      staticPromise,
      dynamicPromise
    ])

    const [branches, years, semesters] = staticResults
    const { recentUpdates, upcomingExams, upcomingReminders } = dynamicResults

    const responseBody = {
      profile: {
        id: profileRow.id,
        roll_number: profileRow.roll_number,
        name: profileRow.name,
        email: profileRow.email,
        section: profileRow.section,
        role: profileRow.role,
        year: currentYear ?? null,
        branch: branchCode ?? null,
        semester: semesterNumber ?? null
      },
      subjects: subjectsResult.data || [],
      static: {
        branches: branches?.data || [],
        years: years?.data || [],
        semesters: semesters?.data || []
      },
      dynamic: {
        recentUpdates: recentUpdates?.data || [],
        upcomingExams: upcomingExams?.data || [],
        upcomingReminders: upcomingReminders?.data || []
      },
      contextWarnings,
      timestamp: Date.now(),
      meta: {
        loadedInMs: Date.now() - startTime
      }
    }

    return NextResponse.json(responseBody)
  } catch (error: any) {
    console.error('Bulk fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch data', message: error?.message }, { status: 500 })
  }
}


