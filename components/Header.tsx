'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useProfile } from '@/lib/enhanced-profile-context'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileCache, ProfileDisplayCache } from '@/lib/simple-cache'

export function Header() {
  const { data: session, status } = useSession()
  const { profile, loading: profileLoading } = useProfile()

  const [cachedProfile, setCachedProfile] = useState<ReturnType<typeof ProfileCache.get> | null>(null)
  const [displayCache, setDisplayCache] = useState<ReturnType<typeof ProfileDisplayCache.peek> | null>(() => {
    if (typeof window === 'undefined') return null
    return ProfileDisplayCache.peek()
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const email = session?.user?.email
    if (!email) return
    const cached = ProfileCache.get(email)
    if (cached) setCachedProfile(cached)
    const display = ProfileDisplayCache.get(email)
    if (display) setDisplayCache(display)
  }, [session?.user?.email])

  const displayName = useMemo(() => {
    return session?.user?.name || profile?.name || cachedProfile?.name || displayCache?.name || undefined
  }, [session?.user?.name, profile?.name, cachedProfile?.name, displayCache?.name])

  const showNameSkeleton = !displayName && (status === 'loading' || profileLoading)

  const metaLine = useMemo(() => {
    const source = (profile ?? cachedProfile ?? displayCache) as (typeof profile) | null
    if (!source?.year || !source?.branch) return null
    const parts: string[] = [`Year ${source.year}`]
    if (source.semester) parts.push(`Sem ${source.semester}`)
    parts.push(source.branch)
    return parts.join(' • ')
  }, [profile, cachedProfile, displayCache])

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl md:text-3xl font-bold">
        Welcome, {showNameSkeleton ? (
          <span className="inline-flex align-middle"><Skeleton className="h-6 md:h-7 w-24 inline-block align-middle" /></span>
        ) : (
          <span>{displayName || 'User'}</span>
        )}
      </h1>
      {metaLine ? (
        <div className="text-sm text-muted-foreground">{metaLine}</div>
      ) : (
        (status === 'loading' || profileLoading) && (
          <div className="h-4 w-40"><Skeleton className="h-4 w-40" /></div>
        )
      )}
    </div>
  )
}