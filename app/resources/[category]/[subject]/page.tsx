// app/resources/[category]/[subject]/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight, FileText, ChevronDown, Download, ExternalLink, Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { getResourceTypeForCategory } from '@/lib/resource-utils'
import { useProfile, type Subject } from '@/lib/enhanced-profile-context'
import { getSubjectDisplayByCode } from '@/lib/subject-display'

interface Resource {
  id?: string
  name: string
  description?: string
  date: string
  type: string
  url: string
  unit?: number
}

const CATEGORY_TITLES: Record<string, string> = {
  notes: 'Notes',
  assignments: 'Assignments',
  papers: 'Papers',
  records: 'Records',
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

  // Local state for resources and UI
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set())
  const [loadingFile, setLoadingFile] = useState<string | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<string>('all')

  let decodedSubject = ''
  try {
    decodedSubject = decodeURIComponent(params.subject)
  } catch {
    decodedSubject = ''
  }

  // Compute subject display name using context subjects and category filter
  const subjectNameFromContext = useMemo(() => {
    if (!decodedSubject) return ''
    const resourceType = getResourceTypeForCategory(category)
    const list: Subject[] = Array.isArray(subjects) ? subjects : []
    const filtered = resourceType ? list.filter((s: Subject) => (s?.resource_type || 'resources') === resourceType) : list
    return getSubjectDisplayByCode(filtered, decodedSubject, true)
  }, [subjects, category, decodedSubject])

  const subjectName = subjectNameFromContext
  const categoryTitle = CATEGORY_TITLES[category]

  if (!categoryTitle || !decodedSubject) {
    notFound()
  }

  // Group resources by unit
  const resourcesByUnit = useMemo(() => {
    const grouped: Record<number, Resource[]> = {}
    resources.forEach(resource => {
      const unit = resource.unit || 1
      if (!grouped[unit]) {
        grouped[unit] = []
      }
      grouped[unit].push(resource)
    })
    return grouped
  }, [resources])

  const units = Object.keys(resourcesByUnit).map(Number).sort((a, b) => a - b)

  // Toggle unit expansion
  const toggleUnit = (unit: number) => {
    const newExpanded = new Set(expandedUnits)
    if (newExpanded.has(unit)) {
      newExpanded.delete(unit)
    } else {
      newExpanded.add(unit)
    }
    setExpandedUnits(newExpanded)
  }

  // Handle secure file access
  const handleSecureFileAccess = async (resource: Resource, action: 'view' | 'download') => {
    if (!resource.id) {
      if (action === 'download') {
        const link = document.createElement('a')
        link.href = resource.url!
        link.download = resource.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        window.open(resource.url!, '_blank', 'noopener,noreferrer')
      }
      return
    }

    setLoadingFile(resource.id)

    try {
      const response = await fetch(`/api/resources/${encodeURIComponent(resource.id)}/secure-url`)
      if (!response.ok) {
        let msg = 'Failed to get secure URL'
        try {
          const err = await response.json()
          if (err?.error) msg = err.error
        } catch {}
        throw new Error(msg)
      }
      const { secureUrl } = await response.json()

      if (action === 'download') {
        const link = document.createElement('a')
        link.href = secureUrl
        link.download = resource.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        window.open(secureUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error: unknown) {
      console.error('Failed to access secure file:', error)
    } finally {
      setLoadingFile(null)
    }
  }

  // Fetch resources on mount
  useEffect(() => {
    async function fetchResources() {
      setLoading(true)
      setError(null)

      const currentUrl = new URL(window.location.href)
      const qpYear = currentUrl.searchParams.get('year') || undefined
      const qpSem = currentUrl.searchParams.get('semester') || undefined
      const qpBranch = currentUrl.searchParams.get('branch') || undefined

      const queryParams = new URLSearchParams({
        category,
        subject: decodedSubject
      })

      if (qpYear) queryParams.set('year', qpYear)
      if (qpSem) queryParams.set('semester', qpSem)
      if (qpBranch) queryParams.set('branch', qpBranch)

      try {
        const response = await fetch(`/api/resources?${queryParams.toString()}`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Failed to fetch resources: ${response.status}`)
        }
        const data = await response.json()
        setResources(Array.isArray(data) ? data : [])
      } catch (err: any) {
        console.error('Error fetching resources:', err)
        setError(err.message || 'Failed to load resources')
      } finally {
        setLoading(false)
      }
    }

    fetchResources()
  }, [category, decodedSubject])

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
        <p className="text-muted-foreground">Access all {subjectName} {categoryTitle} organized by unit</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Resources</CardTitle>
          <CardDescription>All {subjectName} {categoryTitle} organized by unit</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && units.length > 0 && (
            <div className="mb-4">
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {units.map(unit => (
                    <SelectItem key={unit} value={unit.toString()}>Unit {unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              {[1,2,3,4,5].map(unit => (
                <div key={unit} className="border rounded-lg p-4">
                  <Skeleton className="h-6 w-32 mb-3" />
                  <div className="space-y-3">
                    {[1,2,3].map(file => (
                      <div key={file} className="flex items-center justify-between">
                        <Skeleton className="h-5 w-48" />
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-20" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && units.length > 0 && (
            <div className="space-y-4">
              {selectedUnit === 'all' ? (
                units.map(unit => (
                  <div key={unit} className="border rounded-lg">
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto"
                      onClick={() => toggleUnit(unit)}
                    >
                      <span className="font-medium">Unit {unit}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedUnits.has(unit) ? 'rotate-180' : ''}`} />
                    </Button>

                    {expandedUnits.has(unit) && (
                      <div className="px-4 pb-4 space-y-3">
                        {resourcesByUnit[unit].map((resource, index) => (
                          <div
                            key={resource.id || `${resource.name}-${index}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/50 rounded-md"
                          >
                            <div className="flex items-center gap-3 mb-2 sm:mb-0">
                              <FileText className="h-4 w-4 text-primary" />
                              <div>
                                <h4 className="font-medium text-sm">{resource.name}</h4>
                                {resource.description && (
                                  <p className="text-xs text-muted-foreground">{resource.description}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {resource.type} • {resource.date}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {(resource.id || resource.url) && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => handleSecureFileAccess(resource, 'download')}
                                    disabled={loadingFile === resource.id}
                                  >
                                    {loadingFile === resource.id ? (
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                      <Download className="mr-1 h-3 w-3" />
                                    )}
                                    Download
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => handleSecureFileAccess(resource, 'view')}
                                    disabled={loadingFile === resource.id}
                                  >
                                    {loadingFile === resource.id ? (
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                      <ExternalLink className="mr-1 h-3 w-3" />
                                    )}
                                    View
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Unit {selectedUnit}</h3>
                  <div className="space-y-3">
                    {resourcesByUnit[parseInt(selectedUnit)].map((resource, index) => (
                      <div
                        key={resource.id || `${resource.name}-${index}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/50 rounded-md"
                      >
                        <div className="flex items-center gap-3 mb-2 sm:mb-0">
                          <FileText className="h-4 w-4 text-primary" />
                          <div>
                            <h4 className="font-medium text-sm">{resource.name}</h4>
                            {resource.description && (
                              <p className="text-xs text-muted-foreground">{resource.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {resource.type} • {resource.date}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {(resource.id || resource.url) && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => handleSecureFileAccess(resource, 'download')}
                                disabled={loadingFile === resource.id}
                              >
                                {loadingFile === resource.id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="mr-1 h-3 w-3" />
                                )}
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => handleSecureFileAccess(resource, 'view')}
                                disabled={loadingFile === resource.id}
                              >
                                {loadingFile === resource.id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <ExternalLink className="mr-1 h-3 w-3" />
                                )}
                                View
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !error && units.length === 0 && (
            <p className="text-muted-foreground">No resources available for this subject.</p>
          )}
        </CardContent>
      </Card>

      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}