'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import ChatBubble from '@/components/ChatBubble'
import Hero from '@/components/Hero'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { BookOpen, Bell, Archive, Phone, AlertCircle, Loader2, Settings, Users, CalendarDays, Clock, Star, ExternalLink, FileText, Edit, FileQuestion } from 'lucide-react'
import { useProfile, ProfileContextType, EnhancedProfileDynamicData } from '@/lib/enhanced-profile-context'
import { useSession } from 'next-auth/react'
import Loader from '@/components/Loader'

type Exam = {
  subject: string
  exam_date: string
  branch: string
  year: string
}

type Reminder = {
  id: string
  title?: string
  due_date?: string
  completed?: boolean
}

type Update = {
  id: string
  title?: string
  created_at?: string
  description?: string
}

interface RecentUpdate {
  id: string | number
  title: string
  date: string
  description?: string
}

interface GroupedResourceItem {
  id: string | number
  title: string
  url: string
}
interface GroupedResources {
  notes: Record<string, GroupedResourceItem[]>
  assignments: Record<string, GroupedResourceItem[]>
  papers: Record<string, GroupedResourceItem[]>
}
interface PrimeDataResponse {
  data: GroupedResources | null
  triggeringSubjects: string[]
}

export default function HomePage() {
  const { profile, dynamicData, loading, error } = useProfile()
  const { status: sessionStatus } = useSession()

  const [usersCount, setUsersCount] = useState<number>(0)

  const [updates, setUpdates] = useState<RecentUpdate[]>([])
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(true)
  const [updatesError, setUpdatesError] = useState<string | null>(null)

  const [primeData, setPrimeData] = useState<PrimeDataResponse | null>(null)
  const [isLoadingPrime, setIsLoadingPrime] = useState(true)
  const [primeError, setPrimeError] = useState<string | null>(null)

  useEffect(() => {
    if (dynamicData?.usersCount) {
      setUsersCount(dynamicData.usersCount)
    }
  }, [dynamicData?.usersCount])

  useEffect(() => {
    let isMounted = true

    if (sessionStatus === 'authenticated') {
      const fetchUpdates = async () => {
        setIsLoadingUpdates(true)
        setUpdatesError(null)
        try {
          const response = await fetch('/api/recent-updates')
          if (!response.ok) throw new Error(`Updates fetch failed: ${response.status}`)
          const data = await response.json()
          if (!Array.isArray(data)) throw new Error('Invalid updates data format.')
          if (isMounted) setUpdates(data)
        } catch (error: any) {
          console.error('Error fetching recent updates:', error)
          if (isMounted) setUpdatesError(error.message || 'Error.')
        } finally {
          if (isMounted) setIsLoadingUpdates(false)
        }
      }

      const fetchPrimeSectionData = async () => {
        setIsLoadingPrime(true)
        setPrimeError(null)
        setPrimeData(null)
        try {
          const response = await fetch('/api/prime-section-data')
          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}))
            throw new Error(`Prime Section fetch failed: ${response.status} - ${errorBody?.error || 'Unknown error'}`)
          }
          const data: PrimeDataResponse = await response.json()
          if (typeof data !== 'object' || data === null || !('data' in data) || !('triggeringSubjects' in data) || !Array.isArray((data as any).triggeringSubjects)) {
            throw new Error('Invalid prime section data format received from API.')
          }
          if (isMounted) setPrimeData(data)
        } catch (error: any) {
          console.error('Error fetching prime section data:', error)
          if (isMounted) setPrimeError(error.message || 'An error occurred loading prime section data.')
        } finally {
          if (isMounted) setIsLoadingPrime(false)
        }
      }

      fetchUpdates()
      fetchPrimeSectionData()
    } else if (sessionStatus === 'unauthenticated') {
      if (isMounted) setIsLoadingUpdates(false)
      if (isMounted) setIsLoadingPrime(false)
    }

    return () => {
      isMounted = false
    }
  }, [sessionStatus])

  if (sessionStatus === 'loading' || loading || isLoadingPrime) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader />
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
            <Breadcrumb items={[
              { label: "♡", isCurrentPage: true }
            ]} />
          </div>
          <div className="flex items-center gap-4">
            {profile?.role && getRoleDisplay(profile.role)}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-md">
              <Users className="h-3 w-3 text-primary" />
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm">
                  {usersCount.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">users</span>
              </div>
            </div>
          </div>
        </div>
        <Hero />

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

      {isLoadingPrime && (
        <div className="mt-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading Exam Prep Section...
        </div>
      )}
      {primeError && !isLoadingPrime && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Exam Prep Section</AlertTitle>
          <AlertDescription>{primeError}</AlertDescription>
        </Alert>
      )}
      {!isLoadingPrime && !primeError && primeData && primeData.data && (
        <div className="mt-8">
          <Card className="border-l-4 border-yellow-500 bg-yellow-50/30 dark:bg-yellow-900/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="h-6 w-6 text-yellow-600" />
                <CardTitle className="text-xl">Prime Section</CardTitle>
              </div>
              <CardDescription>
                Showing key resources for upcoming exam(s) in: <span className="font-medium capitalize">{primeData.triggeringSubjects.join(', ')}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-1 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Notes
                  </h3>
                  {primeData.data.notes && Object.keys(primeData.data.notes).length > 0 ? (
                    Object.entries(primeData.data.notes).map(([groupKey, items]) => (
                      <div key={`notes-${groupKey}`}>
                        <h4 className="font-medium mb-1">{groupKey}</h4>
                        <ul className="space-y-1 list-none pl-2">
                          {items.map((item) => (
                            <li key={item.id}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1.5 group"
                              >
                                <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                                {item.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground pl-2 italic">No relevant notes found.</p>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-1 flex items-center gap-2">
                    <Edit className="h-5 w-5 text-primary" /> Assignments
                  </h3>
                  {primeData.data.assignments && Object.keys(primeData.data.assignments).length > 0 ? (
                    Object.entries(primeData.data.assignments).map(([groupKey, items]) => (
                      <div key={`assign-${groupKey}`}>
                        <h4 className="font-medium mb-1">{groupKey}</h4>
                        <ul className="space-y-1 list-none pl-2">
                          {items.map((item) => (
                            <li key={item.id}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1.5 group"
                              >
                                <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                                {item.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground pl-2 italic">No relevant assignments found.</p>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-1 flex items-center gap-2">
                    <FileQuestion className="h-5 w-5 text-primary" /> Papers
                  </h3>
                  {primeData.data.papers && Object.keys(primeData.data.papers).length > 0 ? (
                    Object.entries(primeData.data.papers).map(([groupKey, items]) => (
                      <div key={`paper-${groupKey}`}>
                        <h4 className="font-medium mb-1">{groupKey}</h4>
                        <ul className="space-y-1 list-none pl-2">
                          {items.map((item) => (
                            <li key={item.id}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1.5 group"
                              >
                                <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                                {item.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground pl-2 italic">No relevant papers found.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoadingPrime && !primeError && primeData && !primeData.data && (
        <div className="mt-8 text-center text-muted-foreground italic text-sm">(No exams upcoming in the next few days)</div>
      )}

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
                        <Clock className="h-3 w-3" /> {exam.exam_date && !isNaN(new Date(exam.exam_date).getTime()) ? new Date(exam.exam_date).toDateString() : "Date unavailable"}
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
                    <p className="text-sm text-muted-foreground">Due {r.due_date && typeof r.due_date === "string" && !isNaN(new Date(r.due_date).getTime()) ? new Date(r.due_date).toDateString() : "Invalid date"}</p>
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
            {isLoadingUpdates && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading updates...</span>
              </div>
            )}
            {updatesError && !isLoadingUpdates && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Updates</AlertTitle>
                <AlertDescription>{updatesError}</AlertDescription>
              </Alert>
            )}
            {!isLoadingUpdates && !updatesError && updates.length > 0 && (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div key={update.id} className="border-l-4 border-primary pl-4 transition-colors hover:bg-muted/50 py-1">
                    <h3 className="font-medium">
                      {update.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{update.date}</p>
                    {update.description && <p className="text-sm text-muted-foreground mt-1">{update.description}</p>}
                  </div>
                ))}
              </div>
            )}
            {!isLoadingUpdates && !updatesError && updates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent updates found.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}
