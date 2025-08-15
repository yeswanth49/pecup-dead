import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export const runtime = 'nodejs'

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = session.user.email.toLowerCase()
  const supabase = createSupabaseAdmin()
  const { count, error: countErr } = await supabase.from('admins').select('id', { count: 'exact', head: true })
  if (countErr) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  const adminCount = count || 0
  if (adminCount > 0) {
    // If there are any rows at all, do nothing
    return NextResponse.json({ ok: true, message: 'Admins table not empty; no changes' })
  }
  const { data, error } = await supabase.from('admins').insert({ email, role: 'superadmin' }).select('email,role').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, bootstrapped: data })
}


