'use client'

import Link from "next/link"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight, Users, Loader2 } from "lucide-react"
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { useProfile } from '@/lib/enhanced-profile-context'
import { notFound } from 'next/navigation'
import ResourcesFiltersClient from './ResourcesFiltersClient'

const resourceData = {
  notes: {
    title: "Notes",
    description: "Lecture notes and study materials",
  },
  assignments: {
    title: "Assignments",
    description: "Assignment questions all batches",
  },
  papers: {
    title: "Papers",
    description: "Mid-1, Mid-2, Previous year papers",
  },
  records: {
    title: "Records",
    description: "Records and manuals for specific weeks",
  },
} as const

export default function CategoryPage({ params, searchParams }: {
  params: { category: string }
  searchParams: { year?: string; semester?: string; branch?: string }
}) {
  const { profile } = useProfile()

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

  const { category } = params
  const resolvedSearchParams = searchParams

  if (!resourceData[category as keyof typeof resourceData]) {
    notFound()
  }
  const categoryData = resourceData[category as keyof typeof resourceData]

  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Header />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-foreground">Home</Link>
              <ChevronRight className="h-4 w-4" />
              <Link href="/resources" className="hover:text-foreground">Resources</Link>
              <ChevronRight className="h-4 w-4" />
              <span aria-current="page">{categoryData.title}</span>
            </nav>
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
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-start">
            <h1 className="text-3xl font-bold tracking-tight">{categoryData.title}</h1>
          </div>
          <p className="text-muted-foreground">{categoryData.description}</p>
        </div>

        <ResourcesFiltersClient category={category} categoryData={categoryData} />
        <ChatBubble href="https://chat.pecup.in" />
      </div>
    </div>
  )
}