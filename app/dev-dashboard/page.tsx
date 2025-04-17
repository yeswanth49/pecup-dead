'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import ChatBubble from '@/components/ChatBubble'
import ResourceUploadForm from '@/components/ResourceUploadForm'

// 1) Read & parse authorized emails from your env
const authorizedEmails = (process.env.NEXT_PUBLIC_AUTHORIZED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

// Simple Card (replace with your UI lib if you have one)
const Card = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div className={`bg-card text-card-foreground border rounded-lg shadow-md p-6 ${className}`}>
    {children}
  </div>
)

export default function DeveloperDashboardPage() {
  const { data: session, status } = useSession()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const isLoading = status === 'loading'

  useEffect(() => {
    // wait for session to resolve
    if (isLoading) return

    // if not signed in, force a sign in prompt
    if (!session) {
      setIsAuthorized(false)
      return
    }

    // signed in – check against our authorizedEmails list
    const email = session.user?.email?.toLowerCase() || ''
    const allowed = authorizedEmails.includes(email)
    setIsAuthorized(allowed)
  }, [session, isLoading])

  // 2) Loading state
  if (isLoading || isAuthorized === null) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading user session…</p>
      </div>
    )
  }

  // 3) Not signed in at all → show sign in button
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="max-w-md text-center">
          <h2 className="text-xl font-semibold mb-4">Please Sign In</h2>
          <button
            onClick={() => signIn('google')}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Sign In with Google
          </button>
        </Card>
      </div>
    )
  }

  // 4) Signed in but unauthorized
  if (!isAuthorized) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-center p-4">
        <Card className="max-w-md">
          <h1 className="text-xl font-semibold text-destructive mb-4">
            Access Denied
          </h1>
          <p className="mb-4">
            Your account ({session.user?.email}) is not on the approved
            developer list.
          </p>
          <p className="mb-6">Please login with a developer‑approved email.</p>
        <button
          onClick={() =>
            signOut({
              // When signOut completes, go to /login
              callbackUrl: '/login',
            })
          }
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors"
        >
          Sign Out & Sign In Again
        </button>
        </Card>
      </div>
    )
  }

  // 5) Signed in & authorized → show dashboard
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Developer Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome, {session.user?.name}! Manage resources below.
        </p>
      </div>
      <Card className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Upload New Resource</h2>
        <ResourceUploadForm />
      </Card>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}