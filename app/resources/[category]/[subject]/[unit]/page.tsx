// app/resources/[category]/[subject]/[unit]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, notFound } from 'next/navigation'
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'
import {
  ChevronRight,
  FileText,
  Download,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

interface Resource {
  name: string
  description?: string
  date: string
  type: string
  url: string
}

export default function UnitPage() {
  const params = useParams() as {
    category?: string
    subject?: string
    unit?: string
  }
  const [year, setYear] = useState<string | undefined>(undefined)
  const [semester, setSemester] = useState<string | undefined>(undefined)

  // Local state
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // For breadcrumbs / titles
  const [categoryTitle, setCategoryTitle] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [unitName, setUnitName] = useState('')

  useEffect(() => {
    async function fetchData() {
      // reset state
      setLoading(true)
      setError(null)

      const { category, subject, unit } = params
      if (!category || !subject || !unit) {
        notFound()
        return
      }

      // decode subject
      let decodedSubject: string
      try {
        decodedSubject = decodeURIComponent(subject)
      } catch {
        notFound()
        return
      }

      // validate unit
      const unitNum = parseInt(unit, 10)
      if (isNaN(unitNum) || unitNum <= 0) {
        notFound()
        return
      }

      // set display names
      setCategoryTitle(category.charAt(0).toUpperCase() + category.slice(1))
      setSubjectName(decodedSubject)
      setUnitName(`Unit ${unitNum}`)

      // read URL search params for year/semester
      const currentUrl = new URL(window.location.href)
      const qpYear = currentUrl.searchParams.get('year') || undefined
      const qpSem = currentUrl.searchParams.get('semester') || undefined
      setYear(qpYear || undefined)
      setSemester(qpSem || undefined)

      // fetch from relative API route on the same origin
      const qs = new URLSearchParams({ category, subject: decodedSubject, unit: String(unitNum) })
      if (qpYear) {
        // Convert short academic year (1-4) to batch_year (e.g., 2 -> 2024)
        const yearNum = parseInt(qpYear, 10)
        if (!isNaN(yearNum) && yearNum >= 1 && yearNum <= 4) {
          // Map academic year to batch year relative to current year
          // Example: if current year is 2025, academic year 1 => batch 2025, 2 => 2024, etc.
          const currentYear = new Date().getFullYear()
          const batchYear = currentYear - (yearNum - 1)
          qs.set('year', String(batchYear))
        } else {
          qs.set('year', qpYear)
        }
      }
      if (qpSem) qs.set('semester', qpSem)
      const qpBranch = currentUrl.searchParams.get('branch') || undefined
      if (qpBranch) qs.set('branch', qpBranch)
      const apiUrl = `/api/resources?${qs.toString()}`

      try {
        const res = await fetch(apiUrl, { cache: 'no-store' })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`Status ${res.status}: ${text}`)
        }
        const body = await res.json()
        // Debug: log API response to help troubleshoot missing resources in UI
        // (Remove this log after debugging)
        console.debug('DEBUG: /api/resources response', body)
        // normalize two possible shapes
        if (Array.isArray(body)) {
          setResources(body)
        } else if (body.resources && Array.isArray(body.resources)) {
          setResources(body.resources)
        } else {
          throw new Error('Invalid data format.')
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Failed to fetch resources.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params])

  // full‐screen loader
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          {/* Breadcrumbs skeleton */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Title skeleton */}
          <div className="flex items-start justify-between">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-5 w-64" />
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Resource item skeletons */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3 mb-3 sm:mb-0">
                    <Skeleton className="h-5 w-5" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // render
  return (
    <div className="space-y-6">
      <div className="space-y-2">
      <Header/>
        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-2 pt-10 text-sm text-muted-foreground">
          <Link href="/resources" className="hover:text-foreground">
            Resources
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            href={`/resources/${params.category}`}
            className="hover:text-foreground"
          >
            {categoryTitle}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            href={`/resources/${params.category}/${encodeURIComponent(
              subjectName
            )}`}
            className="hover:text-foreground"
          >
            {subjectName.toUpperCase()}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{unitName}{year ? ` • Year ${year}` : ''}{semester ? ` • Sem ${semester}` : ''}</span>
        </div>
        {/* Title */}
        <div className="flex items-start">
          <h1 className="text-3xl font-bold tracking-tight">{unitName}</h1>
        </div>
        <p className="text-muted-foreground">
          {subjectName} {categoryTitle} for {unitName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Resources</CardTitle>
          <CardDescription>
            All materials for {unitName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {!error && resources.length > 0 ? (
              resources.map((resource) => (
                <div
                  key={resource.url || resource.name}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 transition-all-smooth hover:shadow-md hover:border-primary"
                >
                  <div className="flex items-center gap-3 mb-3 sm:mb-0">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-medium">{resource.name}</h3>
                      {resource.description && (
                        <p className="text-sm">{resource.description}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {resource.type} • {resource.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {resource.url && (
                      <>
                        <a href={resource.url} download={resource.name}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="transition-all hover:bg-primary hover:text-white"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </a>
                        <a href={resource.url} target="_blank" rel="noreferrer">
                          <Button
                            variant="outline"
                            size="sm"
                            className="transition-all hover:bg-primary hover:text-white"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              !error && (
                <p className="text-muted-foreground">
                  No resources available for this unit.
                </p>
              )
            )}
          </div>
        </CardContent>
      </Card>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}