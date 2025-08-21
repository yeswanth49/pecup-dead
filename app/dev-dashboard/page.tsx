'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { ResourcesSection } from './_components/ResourcesSection'
import { RemindersSection } from './_components/RemindersSection'
import { RecentUpdatesSection } from './_components/RecentUpdatesSection'
import { ExamsSection } from './_components/ExamsSection'
import { SettingsSection } from './_components/SettingsSection'
import { AdminsSection } from './_components/AdminsSection'

type UserContext = {
  role: 'student' | 'representative' | 'admin' | 'superadmin'
  email: string
  name: string
  representativeAssignments?: Array<{
    branch_id: string
    year_id: string
    branch_code: string
    admission_year: number
  }>
}

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
  const [userContext, setUserContext] = useState<UserContext | null>(null)
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

    // Fetch user context and role
    async function fetchUserContext() {
      try {
        const res = await fetch('/api/user/context')
        if (res.ok) {
          const data = await res.json()
          setUserContext(data.userContext)
          // Allow representatives, admins, and superadmins
          const allowed = ['representative', 'admin', 'superadmin'].includes(data.userContext.role)
          setIsAuthorized(allowed)
        } else {
          setIsAuthorized(false)
        }
      } catch (error) {
        console.error('Failed to fetch user context:', error)
        setIsAuthorized(false)
      }
    }

    fetchUserContext()
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
            Your account ({session.user?.email}) does not have the required permissions
            to access the developer dashboard.
          </p>
          <p className="mb-6">You need to be assigned as a representative, admin, or superadmin.</p>
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
  const isAdmin = userContext?.role === 'admin' || userContext?.role === 'superadmin'
  const isRepresentative = userContext?.role === 'representative'
  
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {isRepresentative ? 'Representative Dashboard' : 'Developer Dashboard'}
        </h1>
        <p className="text-muted-foreground">
          Welcome, {session.user?.name}! 
          {isRepresentative && userContext?.representativeAssignments && (
            <span className="block mt-1 text-sm">
              Managing: {userContext.representativeAssignments.map(a => 
                `${a.branch_code} ${a.admission_year} Batch`
              ).join(', ')}
            </span>
          )}
        </p>
      </div>
      <Tabs defaultValue="resources" className="space-y-6">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="updates">Recent Updates</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          {/* Admin-only tabs */}
          {isAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
          {isAdmin && <TabsTrigger value="admins">Admins</TabsTrigger>}
        </TabsList>
        <TabsContent value="resources">
          <Card className="p-4"><ResourcesSection userContext={userContext} /></Card>
        </TabsContent>
        <TabsContent value="archive">
          <Card className="p-4"><ResourcesSection archivedOnly userContext={userContext} /></Card>
        </TabsContent>
        <TabsContent value="reminders">
          <Card className="p-4"><RemindersSection userContext={userContext} /></Card>
        </TabsContent>
        <TabsContent value="updates">
          <Card className="p-4"><RecentUpdatesSection userContext={userContext} /></Card>
        </TabsContent>
        <TabsContent value="exams">
          <Card className="p-4"><ExamsSection userContext={userContext} /></Card>
        </TabsContent>
        {isAdmin && (
          <TabsContent value="settings">
            <Card className="p-4"><SettingsSection /></Card>
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="admins">
            <Card className="p-4"><AdminsSection /></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}