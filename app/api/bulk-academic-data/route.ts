import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'
import { AcademicConfigManager } from '@/lib/academic-config'
import { getOrSetCache } from '@/lib/redis'

export const runtime = 'nodejs'

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
      meta: { timestamp: Date.now(), path: '/api/bulk-academic-data' }
    },
    { status }
  )
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) {
    return errorResponse('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const startTime = Date.now()
  const t = {
    profileStart: Date.now(),
    profileMs: 0,
    subjectsMs: 0,
    staticMs: 0,
    dynamicMs: 0,
    resourcesMs: 0,
  }
  try {
    const supabase = createSupabaseAdmin()
    const academicConfig = AcademicConfigManager.getInstance()

    // Fetch profile with relations
    const profileRow = await getOrSetCache(
      `profile:${email}`,
      300, // 5 minutes
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id, roll_number, name, email, branch_id, year_id, semester_id, section, role,
            branch:branches(id, name, code),
            year:years(id, batch_year, display_name),
            semester:semesters(id, semester_number)
          `)
          .eq('email', email)
          .maybeSingle()

        if (error) throw error
        return data
      }
    )
    t.profileMs = Date.now() - t.profileStart

    if (!profileRow) {
      return errorResponse('PROFILE_NOT_FOUND', 'Profile not found', 404)
    }

    // Handle Supabase relation shapes that may come as arrays or objects
    const yearRel: any = Array.isArray((profileRow as any).year)
      ? (profileRow as any).year?.[0]
      : (profileRow as any).year
    const branchRel: any = Array.isArray((profileRow as any).branch)
      ? (profileRow as any).branch?.[0]
      : (profileRow as any).branch
    const semesterRel: any = Array.isArray((profileRow as any).semester)
      ? (profileRow as any).semester?.[0]
      : (profileRow as any).semester

    const currentYear = yearRel?.batch_year
      ? await academicConfig.calculateAcademicYear(yearRel.batch_year)
      : null
    const branchCode = branchRel?.code || null
    const semesterNumber = semesterRel?.semester_number || null

    const branchId = profileRow.branch_id
    const yearId = profileRow.year_id
    const semesterId = profileRow.semester_id

    // Defensive: If missing critical context, advise re-auth workflow in message
    const contextWarnings: string[] = []
    if (!branchCode || !currentYear || !semesterNumber) {
      contextWarnings.push('Missing branch/year/semester context. If this persists, please log out and log in again to refresh your profile data.')
    }

    // Fetch subjects using subject_offerings with dynamic regulation (do not hardcode)
    const subjectsPromise = (async () => {
      const secStart = Date.now()
      if (!branchCode || !currentYear || !semesterNumber) return { data: [] as any[] }

      const cacheKey = `subjects:${branchCode}:${currentYear}:${semesterNumber}`
      const result = await getOrSetCache(cacheKey, 3600, async () => { // 1 hour
        // Try to detect latest regulation from offerings for this context, fall back to most recent by created_at
        const { data: regs } = await supabase
          .from('subject_offerings')
          .select('regulation')
          .eq('branch', branchCode)
          .eq('year', currentYear)
          .eq('semester', semesterNumber)
          .eq('active', true)

        const uniqueRegs = regs ? [...new Set(regs.map((r: any) => r.regulation).filter(Boolean))] : []
        let regulation: string | null = null
        if (uniqueRegs.length > 0) {
          const regWithNums = uniqueRegs.map(reg => ({
            reg,
            num: parseInt(reg.replace(/\D/g, '')) || 0
          }))
          const sortedRegs = regWithNums.sort((a, b) => b.num - a.num)
          regulation = sortedRegs[0].reg
        }

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
        // Sort by display_order using offerings order mapping, treating nulls as smaller than numbers, with id tiebreaker for equals including nulls
        const orderMap = new Map<string, number | null>(offerings.map(o => [o.subject_id, o.display_order]))
        const sorted = (subjects || []).slice().sort((a: any, b: any) => {
          const oa = orderMap.get(a.id)
          const ob = orderMap.get(b.id)
          if (oa === ob) {
            return a.id.localeCompare(b.id)
          }
          if (oa == null) return -1
          if (ob == null) return 1
          return oa - ob
        })
        return { data: sorted }
      })

      const duration = Date.now() - secStart
      return { ...result, _meta: { durationMs: duration } }
    })()

    // Static data
    const staticPromise = (async () => {
      const secStart = Date.now()
      const res = await getOrSetCache('static:data', 86400, async () => { // 24 hours
        return await Promise.all([
          supabase.from('branches').select('*'),
          supabase.from('years').select('*'),
          supabase.from('semesters').select('*')
        ])
      })
      t.staticMs = Date.now() - secStart
      return res
    })()

    // Dynamic data
    const dynamicPromise = (async () => {
      const secStart = Date.now()
      const cacheKey = `dynamic:${branchCode || 'all'}:${currentYear || 'all'}`

      const result = await getOrSetCache(cacheKey, 300, async () => { // 5 minutes
        // Dates for exams window
        const start = new Date()
        start.setUTCHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setUTCDate(end.getUTCDate() + 5)
        const startDateStr = start.toISOString().slice(0, 10)
        const endDateStr = end.toISOString().slice(0, 10)

        // Get users count
        const { count: usersCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })

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

        return { recentUpdates, upcomingExams, upcomingReminders, usersCount }
      })

      t.dynamicMs = Date.now() - secStart
      return result
    })()

    // Resources data
    const resourcesPromise = (async () => {
      const secStart = Date.now()
      if (!branchId || !yearId || !semesterId) return {}

      const cacheKey = `resources:${branchId}:${yearId}:${semesterId}`
      const grouped = await getOrSetCache(cacheKey, 3600, async () => { // 1 hour
        const { data: resources, error } = await supabase
          .from('resources')
          .select('*')
          .eq('branch_id', branchId)
          .eq('year_id', yearId)
          .or(`semester_id.eq.${semesterId},semester_id.is.null`)
          .order('unit', { ascending: true })
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[bulk] resources query error:', error)
          return {}
        }

        // Group by category and subject
        const grouped = {} as Record<string, Record<string, any[]>>
        (resources || []).forEach((r: any) => {
          if (!grouped[r.subject]) grouped[r.subject] = {}
          if (!grouped[r.subject][r.category]) grouped[r.subject][r.category] = []
          grouped[r.subject][r.category].push(r)
        })

        return grouped
      })

      t.resourcesMs = Date.now() - secStart
      return grouped
    })()

    const [subjectsResult, staticResults, dynamicResults, resourcesResult] = await Promise.all([
      subjectsPromise,
      staticPromise,
      dynamicPromise,
      resourcesPromise
    ])
    t.subjectsMs = (subjectsResult as any)?._meta?.durationMs ?? t.subjectsMs

    const [branches, years, semesters] = staticResults
    const { recentUpdates, upcomingExams, upcomingReminders, usersCount } = dynamicResults

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
        upcomingReminders: upcomingReminders?.data || [],
        usersCount: usersCount || 0
      },
      resources: resourcesResult || {},
      contextWarnings,
      timestamp: Date.now(),
      meta: {
        loadedInMs: Date.now() - startTime,
        timings: {
          profileMs: t.profileMs,
          subjectsMs: t.subjectsMs,
          staticMs: t.staticMs,
          dynamicMs: t.dynamicMs,
          resourcesMs: t.resourcesMs,
        }
      }
    }

    return NextResponse.json(responseBody)
  } catch (error: any) {
    console.error('Bulk fetch error:', error)
    const message = typeof error?.message === 'string' ? error.message : 'Failed to fetch data'
    return errorResponse('INTERNAL_ERROR', message, 500)
  }
}


