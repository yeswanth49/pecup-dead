import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    redirect('/login')
  }
  const email = session.user.email.toLowerCase()

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    // On DB error, be safe and send to onboarding to re-attempt later
    redirect('/onboarding')
  }
  if (!data) {
    redirect('/onboarding')
  }

  return <>{children}</>
}


