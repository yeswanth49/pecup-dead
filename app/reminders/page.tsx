// app/reminders/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import ChatBubble from '@/components/ChatBubble'
import {
  Loader2,
  CalendarClock,
  AlertCircle,
  Clock,
  Activity,
  Users,
} from 'lucide-react'
import { useProfile } from '@/lib/enhanced-profile-context'
import { getRoleDisplay } from '@/lib/role-utils'

interface Reminder {
  title: string
  dueDate: string
  description: string
  iconType?: string
}

// helper for icon
function getIcon(iconType?: string) {
  const cls = 'mt-1 h-5 w-5 text-primary'
  switch (iconType?.toLowerCase()) {
    case 'alert':
      return <AlertCircle className={cls} />
    case 'clock':
      return <Clock className={cls} />
    case 'calendar':
      return <CalendarClock className={cls} />
    default:
      return <Activity className={cls} />
  }
}

export default function RemindersPage() {
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [usersCount, setUsersCount] = useState<number>(0)
  const [isLoadingUsersCount, setIsLoadingUsersCount] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchUsersCount = async () => {
      setIsLoadingUsersCount(true)
      try {
        const response = await fetch('/api/users-count')
        if (response.ok) {
          const data = await response.json()
          if (mounted) setUsersCount(data.totalUsers)
        }
      } catch {
        // silent
      } finally {
        if (mounted) setIsLoadingUsersCount(false)
      }
    }
    fetchUsersCount()
    const interval = setInterval(fetchUsersCount, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])


  useEffect(() => {
    async function fetchReminders() {
      setLoading(true)
      setError(null)

      try {
        // client‐side can hit the relative URL
        const res = await fetch('/api/reminders', { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Status ${res.status}`)
        }
        const data = await res.json()
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format')
        }
        setReminders(data)
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'An error occurred loading reminders.')
      } finally {
        setLoading(false)
      }
    }

    fetchReminders()
  }, [])

  // FULL‑SCREEN LOADER
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // ACTUAL PAGE
  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Header />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Breadcrumb items={[
              { label: "Home", href: "/" },
              { label: "Reminders", isCurrentPage: true }
            ]} />
          </div>
          <div className="flex items-center gap-4">
            {profile?.role && getRoleDisplay(profile.role)}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-md">
              <Users className="h-3 w-3 text-primary" />
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm">
                  {isLoadingUsersCount ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    usersCount.toLocaleString()
                  )}
                </span>
                <span className="text-xs text-muted-foreground">users</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-center">Reminders</h1>
          <p className="text-muted-foreground text-center">
            Important deadlines and announcements
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Reminders</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && reminders.length === 0 && (
        <p className="text-muted-foreground">No active reminders found.</p>
      )}

      <div className="grid gap-4">
        {!error &&
          reminders.map((r, idx) => (
            <Card
              key={idx}
              className="border-l-4 border-primary transition-all-smooth hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-2">
                {getIcon(r.iconType)}
                <div>
                  <CardTitle>{r.title}</CardTitle>
                  {r.dueDate && (
                    <CardDescription>{r.dueDate}</CardDescription>
                  )}
                </div>
              </CardHeader>
              {r.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {r.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}