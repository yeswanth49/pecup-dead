'use client'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export function Header() {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<{ year?: number; branch?: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        setProfile(json?.profile || null)
      } catch {}
    }
    if (status === 'authenticated') load()
  }, [status])

  // You can handle loading / unauthenticated here if you like
  if (status === 'loading') {
    return <div>Loading…</div>
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