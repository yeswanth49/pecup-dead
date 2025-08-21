'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type Resource = {
  id: string
  name: string
  category: string
  subject: string
  unit: number
  type?: string | null
  year?: number | null
  branch?: string | null
  semester?: number | null
  date: string
  is_pdf: boolean
  url: string
  archived: boolean
}

type UserContext = {
  role: 'student' | 'representative' | 'admin' | 'superadmin'
  email: string
  name: string
  representativeAssignments?: Array<{
    branch_id: string
    year_id: string
    branch_code: string
    admission_year: number
  }>
}

const BRANCHES = ['CSE','AIML','DS','AI','ECE','EEE','MEC','CE']

export function ResourcesSection({ 
  archivedOnly = false, 
  userContext 
}: { 
  archivedOnly?: boolean
  userContext: UserContext | null
}) {
  const [items, setItems] = useState<Resource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const [filters, setFilters] = useState<{ subject?: string; category?: string; unit?: number | null; year?: number | null; semester?: number | null; branch?: string }>({})
  const [profile, setProfile] = useState<{ year: number; branch: string } | null>(null)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', '1')
    p.set('limit', '1000')
    p.set('sort', 'date')
    p.set('order', 'desc')
    p.set('archived', archivedOnly ? 'true' : 'false')
    if (filters.subject) p.set('subject', filters.subject)
    if (filters.category) p.set('category', filters.category)
    if (filters.unit != null) p.set('unit', String(filters.unit))
    if (filters.year != null) p.set('year', String(filters.year))
    if (filters.semester != null) p.set('semester', String(filters.semester))
    if (filters.branch) p.set('branch', filters.branch)
    return p.toString()
  }, [filters, archivedOnly])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/resources?${query}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed')
      setItems(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [query, refreshIndex])

  useEffect(() => {
    // For representatives, prefill and lock filters to their assigned scope
    if (userContext?.role === 'representative' && userContext.representativeAssignments) {
      const assignments = userContext.representativeAssignments
      if (assignments.length === 1) {
        // Single assignment - lock to that branch/year
        const assignment = assignments[0]
        setFilters((f) => ({ 
          ...f, 
          year: assignment.admission_year, 
          branch: assignment.branch_code 
        }))
      } else if (assignments.length > 1) {
        // Multiple assignments - allow selection within assigned scope only
        // Default to first assignment
        const assignment = assignments[0]
        setFilters((f) => ({ 
          ...f, 
          year: f.year ?? assignment.admission_year, 
          branch: f.branch || assignment.branch_code 
        }))
      }
    }
  }, [userContext])

  async function handleDelete(id: string) {
    if (!confirm('Delete this resource?')) return
    try {
      const res = await fetch(`/api/admin/resources/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRefreshIndex((i) => i + 1)
      } else {
        let errorMessage = 'Delete failed'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          try {
            errorMessage = await res.text() || errorMessage
          } catch {
            // Keep default message
          }
        }
        console.error('Delete failed:', { status: res.status, statusText: res.statusText, error: errorMessage })
        alert(`Delete failed: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Network error during delete:', error)
      alert('Delete failed: Network error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Year/Branch derived from profile if present */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <Label>Category</Label>
          <Select value={filters.category || 'any'} onValueChange={(v) => setFilters((f) => ({ ...f, category: v === 'any' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="notes">notes</SelectItem>
              <SelectItem value="assignments">assignments</SelectItem>
              <SelectItem value="papers">papers</SelectItem>
              <SelectItem value="records">records</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" placeholder="dbms" value={filters.subject || ''} onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1 min-w-[120px]">
          <Label>Unit</Label>
          <Select value={filters.unit != null ? String(filters.unit) : 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, unit: v === 'all' ? null : Number(v) }))}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {[1,2,3,4,5].map((u) => (
                <SelectItem key={u} value={String(u)}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[120px]">
          <Label>Year</Label>
          <Select 
            value={filters.year != null ? String(filters.year) : 'all'} 
            onValueChange={(v) => setFilters((f) => ({ ...f, year: v === 'all' ? null : Number(v) }))}
            disabled={userContext?.role === 'representative' && userContext.representativeAssignments?.length === 1}
          >
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {userContext?.role === 'representative' && userContext.representativeAssignments ? (
                // Representatives can only see their assigned years
                userContext.representativeAssignments.map((assignment) => (
                  <SelectItem key={assignment.admission_year} value={String(assignment.admission_year)}>
                    {assignment.admission_year} Batch
                  </SelectItem>
                ))
              ) : (
                // Admins can see all years
                <>
                  <SelectItem value="all">All</SelectItem>
                  {[2021, 2022, 2023, 2024].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y} Batch</SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <Label>Semester</Label>
          <Select value={filters.semester != null ? String(filters.semester) : 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, semester: v === 'all' ? null : Number(v) }))}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {[1,2].map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <Label>Branch</Label>
          <Select 
            value={filters.branch || 'any'} 
            onValueChange={(v) => setFilters((f) => ({ ...f, branch: v === 'any' ? '' : v }))}
            disabled={userContext?.role === 'representative' && userContext.representativeAssignments?.length === 1}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {userContext?.role === 'representative' && userContext.representativeAssignments ? (
                // Representatives can only see their assigned branches
                userContext.representativeAssignments.map((assignment) => (
                  <SelectItem key={assignment.branch_code} value={assignment.branch_code}>
                    {assignment.branch_code}
                  </SelectItem>
                ))
              ) : (
                // Admins can see all branches
                <>
                  <SelectItem value="any">Any</SelectItem>
                  {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setRefreshIndex((i) => i + 1)} disabled={loading}>Refresh</Button>
          <CreateResourceDialog
            onCreated={() => setRefreshIndex((i) => i + 1)}
            defaultArchived={archivedOnly}
            userContext={userContext}
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Sem</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>isPDF</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.year ?? '-'}</TableCell>
                <TableCell>{r.semester ?? '-'}</TableCell>
                <TableCell>{r.branch ?? '-'}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell>{r.subject}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.type || '-'}</TableCell>
                <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                <TableCell>{r.is_pdf ? 'Yes' : 'No'}</TableCell>
                <TableCell className="whitespace-nowrap flex gap-2">
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">Open</Button>
                  </a>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'No resources found'}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CreateResourceDialog({ 
  onCreated, 
  defaultArchived = false, 
  userContext 
}: { 
  onCreated: () => void
  defaultArchived?: boolean
  userContext: UserContext | null
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('notes')
  const [subject, setSubject] = useState('')
  const [unit, setUnit] = useState<number>(1)
  const [type, setType] = useState('')
  
  // For representatives, default to their first assignment
  const defaultAssignment = userContext?.representativeAssignments?.[0]
  const [year, setYear] = useState<number | ''>(defaultAssignment?.admission_year ?? '')
  const [branch, setBranch] = useState<string | ''>(defaultAssignment?.branch_code ?? '')
  const [semester, setSemester] = useState<number | ''>('')
  const [file, setFile] = useState<File | null>(null)
  
  const isRepresentative = userContext?.role === 'representative'
  const assignments = userContext?.representativeAssignments || []

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!year || !branch) {
        throw new Error('Year and Branch are required for uploads')
      }
      const form = new FormData()
      form.set('name', name)
      form.set('description', description)
      form.set('category', category)
      form.set('subject', subject)
      form.set('unit', String(unit))
      if (type) form.set('type', type)
      form.set('year', String(year))
      if (semester) form.set('semester', String(semester))
      form.set('branch', String(branch))
      if (defaultArchived) form.set('archived', 'true')
      if (file) form.set('file', file)

      const res = await fetch('/api/admin/resources', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create')
      setOpen(false)
      onCreated()
      // reset
      setName(''); setDescription(''); setCategory('notes'); setSubject(''); setUnit(1); setType(''); setYear(defaultYear ?? ''); setSemester(''); setBranch(defaultBranch ?? ''); setFile(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Resource</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} required />
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div>
              <Label>Unit</Label>
              <Input type="number" min={1} value={unit} onChange={(e) => setUnit(Number(e.target.value))} required />
            </div>
            <div>
              <Label>Type</Label>
              <Input value={type} onChange={(e) => setType(e.target.value)} />
            </div>
            <div>
              <Label>Year (Admission Batch)</Label>
              <Select 
                value={year ? String(year) : 'none'} 
                onValueChange={(v) => setYear(v === 'none' ? '' : Number(v))}
                disabled={isRepresentative && assignments.length === 1}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {isRepresentative && assignments.length > 0 ? (
                    // Representatives can only upload for their assigned years
                    assignments.map((assignment) => (
                      <SelectItem key={assignment.admission_year} value={String(assignment.admission_year)}>
                        {assignment.admission_year} Batch
                      </SelectItem>
                    ))
                  ) : (
                    // Admins can upload for any year
                    <>
                      <SelectItem value="none">None</SelectItem>
                      {[2021, 2022, 2023, 2024].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y} Batch</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Semester</Label>
              <Select value={semester ? String(semester) : 'none'} onValueChange={(v) => setSemester(v === 'none' ? '' : Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {[1,2].map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch</Label>
              <Select 
                value={branch || 'none'} 
                onValueChange={(v) => setBranch(v === 'none' ? '' : v)}
                disabled={isRepresentative && assignments.length === 1}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {isRepresentative && assignments.length > 0 ? (
                    // Representatives can only upload for their assigned branches
                    assignments.map((assignment) => (
                      <SelectItem key={assignment.branch_code} value={assignment.branch_code}>
                        {assignment.branch_code}
                      </SelectItem>
                    ))
                  ) : (
                    // Admins can upload for any branch
                    <>
                      <SelectItem value="none">None</SelectItem>
                      {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>File</Label>
              <Input type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


