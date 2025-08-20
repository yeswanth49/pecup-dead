'use client'
import { useSession } from 'next-auth/react'
import { useProfile } from '@/lib/profile-context'
import { Skeleton } from '@/components/ui/skeleton'

export function Header() {
  const { data: session, status } = useSession()
  const { profile, loading: profileLoading } = useProfile()

  // Show skeleton animations while loading
  if (status === 'loading' || profileLoading) {
    return (
      <div className="flex flex-col gap-1">
        <div className="pt-6 md:pt-10">
          <Skeleton className="h-8 md:h-10 w-64 md:w-80" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl md:text-3xl pt-6 md:pt-10 font-bold">Welcome, {session?.user?.name || 'User'}</h1>
      {profile?.year && profile?.branch && (
        <div className="text-sm text-muted-foreground">{`Year ${profile.year} • ${profile.branch}`}</div>
      )}
    </div>
  )
}