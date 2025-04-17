'use client'
import { useSession } from 'next-auth/react'

export function Header() {
  const { data: session, status } = useSession()

  // You can handle loading / unauthenticated here if you like
  if (status === 'loading') {
    return <div>Loading…</div>
  }

  return (
    <div>
    <h1 className="text-2xl md:text-3xl pt-6 md:pt-10 font-bold">Welcome, {session?.user?.name || 'User'}</h1>
    </div>
  )
}