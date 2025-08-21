'use client'
import { useSession } from 'next-auth/react'
import { useProfile } from '@/lib/profile-context'
import { Skeleton } from '@/components/ui/skeleton'

export function Header() {
  const { data: session, status } = useSession()
  const { profile, loading: profileLoading } = useProfile()

  // Debug logging
  console.log('Header render:', {
    sessionStatus: status,
    profileLoading,
    hasProfile: !!profile,
    profileData: profile
  })

  // Only show skeleton animations if we're actually fetching data for the first time
  const shouldShowSkeleton = status === 'loading' || (profileLoading && !profile)

  if (shouldShowSkeleton) {
    return (
      <div className="flex flex-col gap-1">
        <div className="pt-2 md:pt-4">
          <Skeleton className="h-8 md:h-10 w-64 md:w-80" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl md:text-3xl pt-2 md:pt-4 font-bold">
        Welcome, {session?.user?.name || 'User'}
      </h1>
      {profile?.year && profile?.branch && (
        <div className="text-sm text-muted-foreground">
          {profile?.semester?.semester_number 
            ? `Year ${profile.year} • Sem ${profile.semester.semester_number} • ${profile.branch}`
            : `Year ${profile.year} • ${profile.branch}`
          }
        </div>
      )}
    </div>
  )
}