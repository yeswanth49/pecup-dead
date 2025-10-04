// app/resources/[category]/[subject]/page.tsx
'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight, FileText } from "lucide-react"
import { getResourceTypeForCategory } from '@/lib/resource-utils'
import { useProfile } from '@/lib/enhanced-profile-context'
import { getSubjectDisplayByCode } from '@/lib/subject-display'

const CATEGORY_TITLES: Record<string, string> = {
  notes: 'Notes',
  assignments: 'Assignments',
  papers: 'Papers',
  records: 'Records',
}

function defaultUnitsForCategory(category: string): string[] {
  switch (category) {
    case 'papers':
      return ['Mid-1', 'Mid-2', 'Sem', 'Prev']
    case 'records':
      return ['Week 1', 'Week 2', 'Week 3', 'Week 4']
    default:
      return ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
  }
}

export default function SubjectPage({
  params,
  searchParams,
}: {
  params: { category: string; subject: string }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const { category } = params
  const { subjects } = useProfile()

  let decodedSubject = ''
  try {
    decodedSubject = decodeURIComponent(params.subject)
  } catch {
    decodedSubject = '' // Set to empty string instead of returning
  }

  // Compute subject display name using context subjects and category filter
  const subjectNameFromContext = useMemo(() => {
    if (!decodedSubject) return ''
    const resourceType = getResourceTypeForCategory(category)
    const list = Array.isArray(subjects) ? subjects : []
    const filtered = resourceType ? list.filter((s: any) => (s?.resource_type || 'resources') === resourceType) : list
    return getSubjectDisplayByCode(filtered as any, decodedSubject, true)
  }, [subjects, category, decodedSubject])

  const subjectName = subjectNameFromContext
  const units = useMemo(() => defaultUnitsForCategory(category), [category])

  const categoryTitle = CATEGORY_TITLES[category]
  if (!categoryTitle || !decodedSubject) {
    notFound()
  }
  // moved above to satisfy hooks-at-top rule

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Header/>
        <nav className="flex items-center pt-2 gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/resources" className="hover:text-foreground">Resources</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/resources/${category}`} className="hover:text-foreground">{categoryTitle}</Link>
          <ChevronRight className="h-4 w-4" />
          <span aria-current="page">{subjectName}</span>
        </nav>

        <div className="flex items-start">
          <h1 className="text-3xl font-bold tracking-tight">{subjectName} {categoryTitle}</h1>
        </div>
        <p className="text-muted-foreground">Access all {subjectName} {categoryTitle} by unit</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((unitLabel, index) => (
          <Link
            key={unitLabel}
            href={`/resources/${category}/${params.subject}/${index + 1}${typeof searchParams.year === 'string' || typeof searchParams.semester === 'string' || typeof searchParams.branch === 'string' ? `?${new URLSearchParams({ ...(typeof searchParams.year === 'string' ? { year: searchParams.year } : {}), ...(typeof searchParams.semester === 'string' ? { semester: searchParams.semester } : {}), ...(typeof searchParams.branch === 'string' ? { branch: searchParams.branch } : {}) }).toString()}` : ''}`}
            className="block"
          >
            <Card className="h-full transition-all-smooth hover-lift">
              <CardHeader>
                <CardTitle>{unitLabel}</CardTitle>
                <CardDescription>Access {subjectName.toUpperCase()} {unitLabel}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <FileText className="h-5 w-5 text-primary" />
                <ChevronRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}