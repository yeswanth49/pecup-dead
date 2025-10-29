import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'
import { TopBar } from '@/components/TopBar'
import { ProfileProvider } from '@/lib/enhanced-profile-context'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    redirect('/login')
  }
  const email = session.user.email.toLowerCase()

  const supabase = createSupabaseAdmin()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email, branch_id, year_id, semester_id')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    // On DB error, be safe and send to onboarding to re-attempt later
    redirect('/onboarding')
  }
  if (!profile) {
    redirect('/onboarding')
  }

  return (
    <div className="w-full">
      <ProfileProvider>
        {children}
      </ProfileProvider>
    </div>
  )
}


