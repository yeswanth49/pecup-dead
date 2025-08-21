import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'

type BranchType = 'CSE' | 'AIML' | 'DS' | 'AI' | 'ECE' | 'EEE' | 'MEC' | 'CE'

interface ProfilePayload {
  name: string
  year: number
  branch: BranchType
  roll_number: string
}

// Convert academic year (1-4) to admission year (2025-2022)
function convertAcademicYearToAdmissionYear(academicYear: number): number {
  // Based on current academic session where 2023 batch = 3rd year
  switch (academicYear) {
    case 1: return 2025 // 1st year -> 2025 admission batch
    case 2: return 2024 // 2nd year -> 2024 admission batch  
    case 3: return 2023 // 3rd year -> 2023 admission batch
    case 4: return 2022 // 4th year -> 2022 admission batch
    default: throw new Error(`Invalid academic year: ${academicYear}`)
  }
}

// Convert admission year (2025-2022) back to academic year (1-4) for frontend display
function convertAdmissionYearToAcademicYear(admissionYear: number): number {
  // Based on current academic session where 2023 batch = 3rd year
  switch (admissionYear) {
    case 2025: return 1 // 2025 -> 1st year
    case 2024: return 2 // 2024 -> 2nd year
    case 2023: return 3 // 2023 -> 3rd year
    case 2022: return 4 // 2022 -> 4th year
    default: throw new Error(`Invalid admission year: ${admissionYear}`)
  }
}

function validatePayload(body: any): { ok: true; data: ProfilePayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' }
  const name = (body.name ?? '').trim()
  const academicYear = Number(body.year)
  const branch = body.branch as BranchType
  const rollNumber = (body.roll_number ?? '').trim()

  const validBranches: BranchType[] = ['CSE', 'AIML', 'DS', 'AI', 'ECE', 'EEE', 'MEC', 'CE']
  if (!name) return { ok: false, error: 'Name is required' }
  if (!Number.isInteger(academicYear) || academicYear < 1 || academicYear > 4) return { ok: false, error: 'Year must be an integer between 1 and 4' }
  if (!validBranches.includes(branch)) return { ok: false, error: 'Invalid branch' }
  if (!rollNumber) return { ok: false, error: 'Roll number is required' }

  // Convert academic year to admission year for database storage
  const year = convertAcademicYearToAdmissionYear(academicYear)

  return { ok: true, data: { name, year, branch, roll_number: rollNumber } }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })
  
  // Convert admission year back to academic year for frontend display
  if (data) {
    try {
      data.year = convertAdmissionYearToAcademicYear(data.year)
      // Add current semester based on time of year
      // Typically: Jan-Jun = Semester 2, Jul-Dec = Semester 1
      const currentMonth = new Date().getMonth() + 1 // getMonth() returns 0-11
      const currentSemester = currentMonth >= 7 ? 1 : 2
      data.semester = {
        semester_number: currentSemester
      }
    } catch (conversionError) {
      console.warn(`Failed to convert admission year ${data.year} to academic year:`, conversionError)
      // Keep the original year if conversion fails
    }
  }
  
  return NextResponse.json({ profile: data ?? null })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validation = validatePayload(body)
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const payload = { email, ...validation.data }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'email' })
    .select('*')
    .single()

  if (error) {
    // Log the full error for debugging
    console.error('Profile update error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload
    })
    
    // Handle uniqueness violations (e.g., roll_number)
    // Postgres error code 23505 is unique_violation
    const isUniqueViolation = (error as any)?.code === '23505'
    const message = isUniqueViolation ? 'Roll number or email already exists' : 'Internal server error'
    return NextResponse.json({ 
      error: message
    }, { status: isUniqueViolation ? 400 : 500 })
  }

  // Convert admission year back to academic year for frontend display
  try {
    data.year = convertAdmissionYearToAcademicYear(data.year)
  } catch (conversionError) {
    console.warn(`Failed to convert admission year ${data.year} to academic year:`, conversionError)
    // Keep the original year if conversion fails
  }

  return NextResponse.json({ profile: data })
}


