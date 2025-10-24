"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import type { Subject } from '@/lib/enhanced-profile-context'
import { getResourceTypeForCategory } from '@/lib/resource-utils'
import { useProfile } from '@/lib/enhanced-profile-context'
import { getSubjectDisplay } from '@/lib/subject-display'

type ResourceSubject = Subject

interface ResourcesFiltersClientProps {
  category: string
  categoryData: {
    title: string
    description: string
  }
}

export default function ResourcesFiltersClient({ category, categoryData }: ResourcesFiltersClientProps) {
  const searchParams = useSearchParams()
  const { subjects, loading } = useProfile()

  const filteredSubjects = useMemo(() => {
    const resourceType = getResourceTypeForCategory(category)
    if (!Array.isArray(subjects) || subjects.length === 0) return []
    if (!resourceType) return subjects as ResourceSubject[]
    return subjects.filter((s: Subject) => (s?.resource_type || 'resources') === resourceType) as ResourceSubject[]
  }, [subjects, category])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {!loading && filteredSubjects.map((s: ResourceSubject) => {
        const qp = new URLSearchParams()
        const year = searchParams.get('year')
        const semester = searchParams.get('semester')
        const branch = searchParams.get('branch')
        if (year) qp.set('year', year)
        if (semester) qp.set('semester', semester)
        if (branch) qp.set('branch', branch)
        const q = qp.toString()

        return (
          <Link key={s.code} href={`/resources/${category}/${encodeURIComponent(s.code)}${q ? `?${q}` : ''}`} className="block">
            <Card className="h-full transition-all-smooth hover-lift">
              <CardHeader>
                <CardTitle>{getSubjectDisplay(s, true)}</CardTitle>
                <CardDescription>Explore resources and tools for {categoryData.title.toUpperCase()}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-end">
                <ChevronRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </Link>
        )
      })}
      {!loading && filteredSubjects.length === 0 && (
        <div className="text-sm text-muted-foreground">No subjects configured for your context.</div>
      )}
      {loading && (
        <>
          <Card className="h-full">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="flex justify-end">
              <Skeleton className="h-5 w-5" />
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardHeader>
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent className="flex justify-end">
              <Skeleton className="h-5 w-5" />
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardHeader>
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-44" />
            </CardHeader>
            <CardContent className="flex justify-end">
              <Skeleton className="h-5 w-5" />
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </div>
  )
}
