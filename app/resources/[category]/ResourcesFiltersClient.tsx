"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Subject } from '@/lib/types'
import { getResourceTypeForCategory, buildSubjectsQuery, getSubjectFilterDescription } from '@/lib/resource-utils'

interface ResourcesFiltersClientProps {
  category: string
  categoryData: {
    title: string
    description: string
  }
}

export default function ResourcesFiltersClient({ category, categoryData }: ResourcesFiltersClientProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const qp = buildSubjectsQuery(searchParams, category)
        const res = await fetch(`/api/subjects?${qp.toString()}`, { cache: 'no-store' })
        const json = await res.json()
        setSubjects(json?.subjects || [])
      } catch (err) {
        console.error('Failed to load subjects:', err)
        setError('Failed to load subjects. Please try again.')
        setSubjects([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [searchParams, category])

  const handleRetry = () => {
    setError(null)
    // Trigger reload by updating loading state
    setLoading(true)
    // The useEffect will handle the actual reload
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center p-6 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-600 mb-2">{error}</p>
          <button 
            onClick={handleRetry}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border">
        {getSubjectFilterDescription(category)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {!loading && subjects.map((s) => {
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
                <CardTitle>{s.code}</CardTitle>
                <CardDescription>Access {s.code} {categoryData.title.toUpperCase()}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-end">
                <ChevronRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </Link>
        )
      })}
      {!loading && subjects.length === 0 && (
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
