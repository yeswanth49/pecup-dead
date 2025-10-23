// app/resources/[category]/[subject]/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight, FileText, ChevronDown, Download, ExternalLink, Loader2, AlertCircle, Search, ArrowUpDown, Filter } from "lucide-react"
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
  const [selectedType, setSelectedType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc'>('date_desc')
  const [query, setQuery] = useState<string>('')
  const [expandAll, setExpandAll] = useState<boolean>(false)

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

  // Types available across resources
  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    resources.forEach(r => {
      if (r.type) set.add(r.type)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [resources])

  // Derived, filtered, and sorted resources
  const visibleResources = useMemo(() => {
    const term = query.trim().toLowerCase()
    const filtered = resources.filter(r => {
      const matchesType = selectedType === 'all' || r.type === selectedType
      const matchesText =
        term.length === 0 ||
        r.name.toLowerCase().includes(term) ||
        (r.description ? r.description.toLowerCase().includes(term) : false)
      const matchesUnit = selectedUnit === 'all' || (r.unit || 1) === parseInt(selectedUnit)
      return matchesType && matchesText && matchesUnit
    })
    const parseDate = (d: string) => {
      const t = Date.parse(d)
      return Number.isNaN(t) ? 0 : t
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
      if (sortBy === 'date_asc') return parseDate(a.date) - parseDate(b.date)
      return parseDate(b.date) - parseDate(a.date) // date_desc
    })
    return sorted
  }, [resources, selectedType, query, selectedUnit, sortBy])

  // Group resources by unit (from filtered list)
  const resourcesByUnit = useMemo(() => {
    const grouped: Record<number, Resource[]> = {}
    visibleResources.forEach(resource => {
      const unit = resource.unit || 1
      if (!grouped[unit]) grouped[unit] = []
      grouped[unit].push(resource)
    })
    // keep items inside each unit sorted by current sort order (already sorted)
    return grouped
  }, [visibleResources])

  const units = useMemo(
    () => Object.keys(resourcesByUnit).map(Number).sort((a, b) => a - b),
    [resourcesByUnit]
  )

  // Keep expanded state in sync with "Expand all"
  useEffect(() => {
    if (selectedUnit !== 'all') {
      setExpandAll(false)
      setExpandedUnits(new Set()) // not used in single-unit view
      return
    }
    if (expandAll) {
      setExpandedUnits(new Set(units))
    } else {
      setExpandedUnits(new Set())
    }
  }, [expandAll, units, selectedUnit])

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
       console.log(`Frontend: Fetching secure URL for resource ${resource.id}`)
       const response = await fetch(`/api/resources/${encodeURIComponent(resource.id)}/secure-url`)
       console.log(`Frontend: Secure URL response status: ${response.status}`)
       if (!response.ok) {
         let msg = 'Failed to get secure URL'
         try {
           const err = await response.json()
           if (err?.error) msg = err.error
         } catch {}
         throw new Error(msg)
       }
       const { secureUrl } = await response.json()
       console.log(`Frontend: Secure URL generated for resource ${resource.id}`)

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

      const normalize = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value[0] : value ?? undefined
      const qpYear = normalize(searchParams.year)
      const qpSem = normalize(searchParams.semester)
      const qpBranch = normalize(searchParams.branch)

      const queryParams = new URLSearchParams({
        category,
        subject: decodedSubject
      })

      if (qpYear) queryParams.set('year', qpYear)
      if (qpSem) queryParams.set('semester', qpSem)
      if (qpBranch) queryParams.set('branch', qpBranch)

      try {
        console.log(`Frontend: Fetching resources with params: ${queryParams.toString()}`)
        const response = await fetch(`/api/resources?${queryParams.toString()}`, { cache: 'no-store' })
        console.log(`Frontend: Response status: ${response.status}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch resources: ${response.status}`)
        }
        const data = await response.json()
        console.log(`Frontend: Received ${Array.isArray(data) ? data.length : 0} resources`)
        setResources(Array.isArray(data) ? data : [])
      } catch (err: any) {
        console.error('Frontend: Error fetching resources:', err)
        setError(err.message || 'Failed to load resources')
      } finally {
        setLoading(false)
      }
    }

    fetchResources()
  }, [category, decodedSubject, searchParams.year, searchParams.semester, searchParams.branch])

  const resultCount = visibleResources.length

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
        <p className="text-muted-foreground">Access all {subjectName} {categoryTitle} with quick filters and smart dropdowns</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Available Resources</CardTitle>
          <CardDescription>
            Filter, sort and browse all {subjectName} {categoryTitle} organized by unit
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

          {!loading && (
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Select value={selectedUnit} onValueChange={(v) => setSelectedUnit(v)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Units</SelectItem>
                      {units.map(unit => (
                        <SelectItem key={unit} value={unit.toString()}>Unit {unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedType} onValueChange={(v) => setSelectedType(v)}>
                    <SelectTrigger className="w-[160px]">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        <SelectValue placeholder="Type" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {availableTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-[170px]">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4" />
                        <SelectValue placeholder="Sort by" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Newest first</SelectItem>
                      <SelectItem value="date_asc">Oldest first</SelectItem>
                      <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-[260px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or description"
                    className="pl-8"
                  />
                </div>
                {selectedUnit === 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandAll(prev => !prev)}
                    className="hidden sm:inline-flex"
                  >
                    <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${expandAll ? 'rotate-180' : ''}`} />
                    {expandAll ? 'Collapse all' : 'Expand all'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {!loading && resultCount > 0 && (
            <p className="mb-2 text-xs text-muted-foreground">
              Showing {resultCount} {resultCount === 1 ? 'item' : 'items'}
            </p>
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
                  <div key={unit} className="border rounded-lg bg-muted/30">
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto"
                      onClick={() => toggleUnit(unit)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Unit {unit}</span>
                        <Badge variant="secondary" className="rounded-full">{resourcesByUnit[unit].length}</Badge>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedUnits.has(unit) ? 'rotate-180' : ''}`} />
                    </Button>

                    {expandedUnits.has(unit) && (
                      <div className="px-4 pb-4 space-y-3">
                        {resourcesByUnit[unit].map((resource, index) => (
                          <div
                            key={resource.id || `${resource.name}-${index}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-background rounded-md border"
                          >
                            <div className="flex items-start gap-3 mb-2 sm:mb-0">
                              <FileText className="h-4 w-4 mt-0.5 text-primary" />
                              <div>
                                <h4 className="font-medium text-sm">{resource.name}</h4>
                                {resource.description && (
                                  <p className="text-xs text-muted-foreground">{resource.description}</p>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{resource.type}</Badge>
                                  <span className="text-xs text-muted-foreground">{resource.date}</span>
                                </div>
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
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Unit {selectedUnit}</h3>
                    <Badge variant="secondary" className="rounded-full">
                      {resourcesByUnit[parseInt(selectedUnit)]?.length || 0}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {resourcesByUnit[parseInt(selectedUnit)]?.map((resource, index) => (
                      <div
                        key={resource.id || `${resource.name}-${index}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-background rounded-md border"
                      >
                        <div className="flex items-start gap-3 mb-2 sm:mb-0">
                          <FileText className="h-4 w-4 mt-0.5 text-primary" />
                          <div>
                            <h4 className="font-medium text-sm">{resource.name}</h4>
                            {resource.description && (
                              <p className="text-xs text-muted-foreground">{resource.description}</p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">{resource.type}</Badge>
                              <span className="text-xs text-muted-foreground">{resource.date}</span>
                            </div>
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
            <div className="rounded-lg border p-6 text-center">
              <p className="text-muted-foreground">No resources match the current filters.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}