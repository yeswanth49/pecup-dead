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

      // fetch from relative API route on the same origin
      const apiUrl = `/api/resources?category=${category}&subject=${encodeURIComponent(
        decodedSubject
      )}&unit=${unitNum}`

      try {
        const res = await fetch(apiUrl, { cache: 'no-store' })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`Status ${res.status}: ${text}`)
        }
        const body = await res.json()
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          <span>{unitName}</span>
        </div>
        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight">{unitName}</h1>
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