// app/resources/[category]/[subject]/page.tsx
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ChevronRight, FileText, ChevronDown, Download, ExternalLink, Loader2, AlertCircle, Search, ArrowUpDown, Filter, RefreshCw, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { getResourceTypeForCategory } from '@/lib/resource-utils'
import { useProfile, type Subject } from '@/lib/enhanced-profile-context'
import { getSubjectDisplayByCode } from '@/lib/subject-display'
import { ResourcesCache } from '@/lib/simple-cache'
import { Resource } from '@/lib/types'

// DTO type that matches the API response format (hybrid format with both legacy and canonical fields)
interface ResourceDTO {
  id: string
  name: string
  title: string
  description?: string
  drive_link: string
  url: string
  file_type: string
  type: string
  branch_id: string
  year_id: string
  semester_id: string
  uploader_id?: string
  created_at: string
  category?: string
  subject?: string
  unit?: number
  date?: string
  is_pdf?: boolean
  branch?: any
  year?: any
  semester?: any
}

// Transformation function to convert API/DTO format to canonical Resource format
function transformResourceDTOToResource(dto: ResourceDTO): Resource {
  return {
    id: dto.id,
    title: dto.title || dto.name, // prefer canonical field, fallback to legacy
    description: dto.description,
    drive_link: dto.drive_link || dto.url, // prefer canonical field, fallback to legacy
    file_type: dto.file_type || dto.type, // prefer canonical field, fallback to legacy
    branch_id: dto.branch_id,
    year_id: dto.year_id,
    semester_id: dto.semester_id,
    uploader_id: dto.uploader_id,
    created_at: dto.created_at || dto.date || new Date().toISOString(), // prefer canonical field, fallback to legacy or current time
    category: dto.category,
    subject: dto.subject,
    unit: dto.unit,
    date: dto.date || dto.created_at, // for backward compatibility in UI
    is_pdf: dto.is_pdf,
    regulation: undefined, // not provided by current API
    archived: false, // default value
    deleted_at: undefined,
    updated_at: dto.created_at,
    branch: dto.branch,
    year: dto.year,
    semester: dto.semester,
    uploader: undefined // not provided by current API
  }
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
  const { subjects, profile } = useProfile()

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
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const lastFetchRef = useRef<number>(0)
  const REVALIDATE_COOLDOWN = 5 * 60 * 1000 // 5 minutes

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
      if (r.type || r.file_type) set.add(r.type || r.file_type)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [resources])

  // Derived, filtered, and sorted resources
  const visibleResources = useMemo(() => {
    const term = query.trim().toLowerCase()
    const filtered = resources.filter(r => {
      const matchesType = selectedType === 'all' || (r.type || r.file_type) === selectedType
      const matchesText =
        term.length === 0 ||
        (r.name || r.title).toLowerCase().includes(term) ||
        (r.description ? r.description.toLowerCase().includes(term) : false)
      const matchesUnit = selectedUnit === 'all' || (r.unit || 1) === parseInt(selectedUnit)
      return matchesType && matchesText && matchesUnit
    })
    const parseDate = (d: string) => {
      const t = Date.parse(d)
      return Number.isNaN(t) ? 0 : t
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || a.title).localeCompare(b.name || b.title)
      if (sortBy === 'date_asc') return parseDate(a.date || a.created_at) - parseDate(b.date || b.created_at)
      return parseDate(b.date || b.created_at) - parseDate(a.date || a.created_at) // date_desc
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

  // Handle file access directly
  const handleFileAccess = (resource: Resource, action: 'view' | 'download') => {
    const url = resource.url || resource.drive_link
    if (!url) {
      console.error('Resource has no URL')
      return
    }

    if (action === 'download') {
      const link = document.createElement('a')
      link.href = url
      link.download = resource.name || resource.title || 'resource'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  // Fetch resources on mount
  useEffect(() => {
    async function fetchResources() {
      lastFetchRef.current = Date.now()
      setLoading(true)
      setError(null)

      // Normalize search params early for cache key
      const normalize = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value[0] : value ?? undefined
      const qpYear = normalize(searchParams.year)
      const qpSem = normalize(searchParams.semester)
      const qpBranch = normalize(searchParams.branch)

      // Compute cache key for logging
      const cacheKey = `resources_${category}_${decodedSubject}_${qpYear || 'none'}_${qpSem || 'none'}_${qpBranch || 'none'}`

      // Check cache first
      const cached = ResourcesCache.get(category, decodedSubject, qpYear, qpSem, qpBranch)
      if (cached) {
        const metadata = ResourcesCache.getCacheMetadata(category, decodedSubject, qpYear, qpSem, qpBranch)
        if (metadata) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEBUG] Resources loaded from cache for key: ${metadata.key}, count: ${cached.length}`)
            console.log(`[DEBUG] Cache age: ${metadata.age} ms (${Math.round(metadata.age / 1000 / 60 / 60)} hours)`)
            if (metadata.isExpired) {
              console.log('[DEBUG] Cache is expired, refetching...')
            }
          }

          // Only use cache if not expired
          if (!metadata.isExpired) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[DEBUG] Resources loaded from cache for key: ${metadata.key}, count: ${cached.length}`)
            }

            setResources(cached)
            setLoading(false)
            return
          }
          // If expired, proceed to fetch fresh data
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] Resources not in cache, fetching from API for key: ${cacheKey}`)
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] Fetching for params: category=${category}, subject=${decodedSubject}, year=${qpYear}, semester=${qpSem}, branch=${qpBranch}`)
      }
      
      const queryParams = new URLSearchParams({
        category,
        subject: decodedSubject
      })

      if (qpYear) queryParams.set('year', qpYear)
      if (qpSem) queryParams.set('semester', qpSem)
      if (qpBranch) queryParams.set('branch', qpBranch)

      const startTime = performance.now()

      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEBUG] Fetching resources - sanitized params:`, {
            category,
            subject: decodedSubject,
            hasYear: !!qpYear,
            hasSem: !!qpSem,
            hasBranch: !!qpBranch
          })
        }
        const response = await fetch(`/api/resources?${queryParams.toString()}`, { cache: 'no-store' })
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEBUG] Response status: ${response.status}`)
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch resources: ${response.status}`)
        }
        const data = await response.json()
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEBUG] Received ${Array.isArray(data) ? data.length : 0} resources`)
        }
        const apiResources = Array.isArray(data) ? data : []

        // Transform API response (DTO format) to canonical Resource format
        const transformedResources: Resource[] = apiResources.map(transformResourceDTOToResource)

        // Log successful transformation for debugging
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEBUG] API returned ${apiResources.length} resources, transformed to canonical Resource format`)
        }

        setResources(transformedResources)
        // Cache the transformed resources (canonical format)
        ResourcesCache.set(category, decodedSubject, transformedResources, qpYear, qpSem, qpBranch)
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[DEBUG] Error fetching resources:', {
            message: err.message,
            hasSensitiveInfo: err.message?.includes('year') || err.message?.includes('semester') || err.message?.includes('branch'),
            errorType: typeof err
          })
        }
        setError(err.message || 'Failed to load resources')
      } finally {
        const duration = performance.now() - startTime
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEBUG] Resource fetch duration: ${Math.round(duration)}ms`)
        }
        setLoading(false)
      }
    }

    fetchResources()
  }, [category, decodedSubject, searchParams.year, searchParams.semester, searchParams.branch, refreshTrigger])

  // Revalidate on window focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now()
      if (!document.hidden && now - lastFetchRef.current > REVALIDATE_COOLDOWN) {
        lastFetchRef.current = now
        setRefreshTrigger(prev => prev + 1)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const resultCount = visibleResources.length

  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Header />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Breadcrumb items={[
              { label: "Home", href: "/" },
              { label: "Resources", href: "/resources" },
              { label: categoryTitle, href: `/resources/${category}` },
              { label: subjectName, isCurrentPage: true }
            ]} />
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
          <div className="flex items-start justify-center">
            <h1 className="text-3xl font-bold tracking-tight text-center">{subjectName} {categoryTitle}</h1>
          </div>
          <p className="text-muted-foreground text-center">Access all {subjectName} {categoryTitle} with quick filters and smart dropdowns</p>
        </div>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRefreshTrigger(prev => prev + 1)}
                  disabled={loading}
                  className="hidden sm:inline-flex"
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Refresh
                </Button>
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
                            key={resource.id || `${resource.name || resource.title}-${index}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-background rounded-md border"
                          >
                            <div className="flex items-start gap-3 mb-2 sm:mb-0">
                              <FileText className="h-4 w-4 mt-0.5 text-primary" />
                              <div>
                                <h4 className="font-medium text-sm">{resource.name || resource.title}</h4>
                                {resource.description && (
                                  <p className="text-xs text-muted-foreground">{resource.description}</p>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{resource.type || resource.file_type}</Badge>
                                  <span className="text-xs text-muted-foreground">{resource.date || resource.created_at}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {(resource.id || resource.url || resource.drive_link) && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => handleFileAccess(resource, 'download')}
                                  >
                                    <Download className="mr-1 h-3 w-3" />
                                    Download
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => handleFileAccess(resource, 'view')}
                                  >
                                    <ExternalLink className="mr-1 h-3 w-3" />
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
                        key={resource.id || `${resource.name || resource.title}-${index}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-background rounded-md border"
                      >
                        <div className="flex items-start gap-3 mb-2 sm:mb-0">
                          <FileText className="h-4 w-4 mt-0.5 text-primary" />
                          <div>
                            <h4 className="font-medium text-sm">{resource.name || resource.title}</h4>
                            {resource.description && (
                              <p className="text-xs text-muted-foreground">{resource.description}</p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">{resource.type || resource.file_type}</Badge>
                              <span className="text-xs text-muted-foreground">{resource.date || resource.created_at}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {(resource.id || resource.url || resource.drive_link) && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => handleFileAccess(resource, 'download')}
                              >
                                <Download className="mr-1 h-3 w-3" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => handleFileAccess(resource, 'view')}
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
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