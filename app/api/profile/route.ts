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

function validatePayload(body: any): { ok: true; data: ProfilePayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' }
  const name = (body.name ?? '').trim()
  const year = Number(body.year)
  const branch = body.branch as BranchType
  const rollNumber = (body.roll_number ?? '').trim()

  const validBranches: BranchType[] = ['CSE', 'AIML', 'DS', 'AI', 'ECE', 'EEE', 'MEC', 'CE']
  if (!name) return { ok: false, error: 'Name is required' }
  if (!Number.isInteger(year) || year < 1 || year > 4) return { ok: false, error: 'Year must be an integer between 1 and 4' }
  if (!validBranches.includes(branch)) return { ok: false, error: 'Invalid branch' }
  if (!rollNumber) return { ok: false, error: 'Roll number is required' }

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
    const message = isUniqueViolation ? 'Roll number or email already exists' : 'Database error'
    return NextResponse.json({ 
      error: message, 
      details: error.message,
      code: error.code 
    }, { status: 400 })
  }

  return NextResponse.json({ profile: data })
}


