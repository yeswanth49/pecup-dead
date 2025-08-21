// app/resources/[category]/[subject]/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight, FileText } from "lucide-react"
import { buildSubjectsQuery } from '@/lib/resource-utils'

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
  const categoryTitle = CATEGORY_TITLES[category]
  if (!categoryTitle) return notFound()

  let decodedSubject = ''
  try {
    decodedSubject = decodeURIComponent(params.subject)
  } catch {
    return notFound()
  }

  const [subjectName, setSubjectName] = useState<string>(decodedSubject.toUpperCase())
  const units = useMemo(() => defaultUnitsForCategory(category), [category])

  useEffect(() => {
    async function load() {
      try {
        const searchParamsObj = new URLSearchParams()
        if (typeof searchParams.year === 'string') searchParamsObj.set('year', searchParams.year)
        if (typeof searchParams.semester === 'string') searchParamsObj.set('semester', searchParams.semester)
        if (typeof searchParams.branch === 'string') searchParamsObj.set('branch', searchParams.branch)
        
        const qp = buildSubjectsQuery(searchParamsObj, category)
        const res = await fetch(`/api/subjects?${qp.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        const subjects = Array.isArray(json?.subjects) ? json.subjects : []
        const found = subjects.find((s: any) => s.code?.toLowerCase() === decodedSubject.toLowerCase())
        if (found?.name) setSubjectName(found.name)
      } catch {}
    }
    load()
  }, [decodedSubject, searchParams.year, searchParams.semester, searchParams.branch, category])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Header/>
        <div className="flex items-center pt-10 gap-2 text-sm text-muted-foreground">
          <Link href="/resources" className="hover:text-foreground">Resources</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/resources/${category}`} className="hover:text-foreground">{categoryTitle}</Link>
          <ChevronRight className="h-4 w-4" />
          <span>{subjectName}</span>
        </div>

        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{subjectName} {categoryTitle}</h1>
          <span className="text-sm text-muted-foreground">
            {typeof searchParams.year === 'string' ? `${searchParams.year} Year` : 'All Years'}{typeof searchParams.semester === 'string' ? `, ${searchParams.semester} Sem` : ''}
          </span>
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