'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { BookOpen, Bell, Archive, Phone, AlertCircle, Loader2, Settings, Users, CalendarDays, Clock } from 'lucide-react'
import { useProfile } from '@/lib/enhanced-profile-context'

interface Exam {
  subject: string
  exam_date: string
  branch: string
  year: string
}

interface Reminder {
  id: string
  title: string
  due_date: string
}

interface Update {
  id: string
  title?: string
  created_at?: string
  description?: string
}

interface DynamicData {
  upcomingExams?: Exam[]
  upcomingReminders?: Reminder[]
  recentUpdates?: Update[]
}

export default function HomePage() {
  const { profile, dynamicData, loading, error } = useProfile() as { profile: any, dynamicData: DynamicData | undefined, loading: boolean, error?: string }

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'student':
        return <Badge variant="secondary">Student</Badge>
      case 'representative':
        return <Badge variant="default">Representative</Badge>
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>
      case 'yeshh':
        return <Badge variant="destructive">Yeshh</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  const getNavigationCards = () => {
    const cards = []

    // Basic navigation for all users
    cards.push(
      <Link key="reminders" href="/reminders" className="block">
        <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Reminders</CardTitle>
            <Bell className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <CardDescription>Important deadlines and announcements</CardDescription>
          </CardContent>
        </Card>
      </Link>
    )

    cards.push(
      <Link key="resources" href="/resources" className="block">
        <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Resources</CardTitle>
            <BookOpen className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <CardDescription>Access notes, assignments, papers, and records</CardDescription>
          </CardContent>
        </Card>
      </Link>
    )

    // Archive for all users
    cards.push(
      <Link key="archive" href="/archive" className="block">
        <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Archive</CardTitle>
            <Archive className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <CardDescription>Previous semester materials and resources</CardDescription>
          </CardContent>
        </Card>
      </Link>
    )

    // Management dashboard for representatives and admins
    if (profile?.role === 'representative' || profile?.role === 'admin' || profile?.role === 'yeshh') {
      const dashboardHref = profile.role === 'representative' ? '/dev-dashboard' : '/dashboard'
      cards.push(
        <Link key="dashboard" href={dashboardHref} className="block">
          <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Management</CardTitle>
              <Settings className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                {profile.role === 'representative' 
                  ? 'Manage resources and promote semesters'
                  : 'Admin dashboard for system management'
                }
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      )
    }

    // Contact card - only show for non-representatives
    if (profile?.role !== 'representative') {
      cards.push(
        <Link key="contact" href="/contact" className="block">
          <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Contact</CardTitle>
              <Phone className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>Get in touch with administration</CardDescription>
            </CardContent>
          </Card>
        </Link>
      )
    }

    return cards
  }

  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Header />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">Your central location for all educational resources and information</p>
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

        {(profile?.role === 'admin' || profile?.role === 'yeshh') && (
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Admin Access</h3>
            <p className="text-sm text-muted-foreground">
              You have full access to manage all resources, users, and system settings across all branches and years.
            </p>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {getNavigationCards()}
      </div>

      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {dynamicData?.upcomingExams && dynamicData.upcomingExams.length > 0 && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <CardTitle>Upcoming Exams (next 5 days)</CardTitle>
              </div>
              <CardDescription>Based on your branch and year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dynamicData.upcomingExams.map((exam: Exam, idx: number) => (
                  <div key={`${exam.subject}-${exam.exam_date}-${idx}`} className="flex items-center justify-between border-l-4 border-primary pl-4">
                    <div>
                      <h3 className="font-medium">{exam.subject}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(exam.exam_date).toDateString()}
                      </p>
                    </div>
                    <Badge variant="outline">{exam.branch} • {exam.year}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {dynamicData?.upcomingReminders && dynamicData.upcomingReminders.length > 0 && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Upcoming Reminders</CardTitle>
              </div>
              <CardDescription>Next deadlines for your context</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dynamicData.upcomingReminders.map((r: Reminder) => (
                  <div key={r.id} className="border-l-4 border-primary pl-4">
                    <h3 className="font-medium">{r.title}</h3>
                    <p className="text-sm text-muted-foreground">Due {new Date(r.due_date).toDateString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription>Latest changes to the resource hub</CardDescription>
          </CardHeader>
          <CardContent>
            {dynamicData?.recentUpdates && dynamicData.recentUpdates.length > 0 && (
              <div className="space-y-4">
                {dynamicData.recentUpdates.map((u: Update) => (
                  <div key={u.id} className="border-l-4 border-primary pl-4 transition-colors hover:bg-muted/50 py-1">
                    <h3 className="font-medium">{u.title || 'Update'}</h3>
                    <p className="text-sm text-muted-foreground">{u.created_at ? new Date(u.created_at).toDateString() : ''}</p>
                    {u.description && <p className="text-sm text-muted-foreground mt-1">{u.description}</p>}
                  </div>
                ))}
              </div>
            )}
            {(!dynamicData?.recentUpdates || dynamicData.recentUpdates.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent updates found.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}


