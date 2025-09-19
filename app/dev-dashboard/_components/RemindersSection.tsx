'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSessionCachedResource } from '@/lib/session-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type Reminder = { id: string; title: string; due_date: string; status?: string | null; year?: number | null; branch?: string | null }

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

export function RemindersSection({ userContext }: { userContext: UserContext | null }) {
  const [items, setItems] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [profile, setProfile] = useState<{ year?: number; branch?: string } | null>(null)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', '1')
    p.set('limit', '50')
    if (status) p.set('status', status)
    
    // For representatives, always filter by their assigned scope
    if (userContext?.role === 'representative' && userContext.representativeAssignments) {
      const assignment = userContext.representativeAssignments[0] // Use first assignment
      if (assignment) {
        p.set('year', String(assignment.admission_year))
        p.set('branch', assignment.branch_code)
      }
    } else if (profile?.year || profile?.branch) {
      // For admins, use profile if available
      if (profile.year) p.set('year', String(profile.year))
      if (profile.branch) p.set('branch', profile.branch)
    }
    
    return p.toString()
  }, [status, profile, userContext])

  async function load() {
    // load via the session cache hook
    setLoading(true)
    setError(null)
    try {
      // The hook also performs background fetch; here we manually fetch and update cache
      const res = await fetch(`/api/admin/reminders?${query}`)
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

  // Integrate with session cache: prefer cached value and revalidate in background
  const cacheKey = useMemo(() => `reminders:${query}`, [query])
  const { data: cached, loading: cacheLoading, error: cacheError, refresh: refreshCache } = useSessionCachedResource<{ id: string; title: string; due_date: string; status?: string | null; year?: number | null; branch?: string | null }[]>(cacheKey, async () => {
    const res = await fetch(`/api/admin/reminders?${query}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || 'Failed')
    return json.data || []
  }, [query])

  useEffect(() => {
    if (cached) setItems(cached)
  }, [cached])

  useEffect(() => {
    // For representatives, set profile to their first assignment
    if (userContext?.role === 'representative' && userContext.representativeAssignments) {
      const assignment = userContext.representativeAssignments[0]
      if (assignment) {
        setProfile({ year: assignment.admission_year, branch: assignment.branch_code })
      }
    }
  }, [userContext])

  async function handleDelete(id: string) {
    if (!confirm('Delete this reminder?')) return
    const res = await fetch(`/api/admin/reminders/${id}`, { method: 'DELETE' })
    if (res.ok) setRefreshIndex((i) => i + 1)
    else alert('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="min-w-[180px]">
          <Label>Status</Label>
          <Input placeholder="e.g., active" value={status} onChange={(e) => setStatus(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={async () => { await refreshCache(); setRefreshIndex((i) => i + 1) }} disabled={loading}>Refresh</Button>
          <CreateReminderDialog onCreated={async () => { await refreshCache(); setRefreshIndex((i) => i + 1) }} userContext={userContext} />
        </div>
      </div>
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{new Date(r.due_date).toLocaleDateString()}</TableCell>
                <TableCell>{r.status || '-'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'No reminders found'}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CreateReminderDialog({ 
  onCreated, 
  userContext 
}: { 
  onCreated: () => void
  userContext: UserContext | null
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('')
  
  // For representatives, default to their assignment
  const defaultAssignment = userContext?.representativeAssignments?.[0]
  const [year, setYear] = useState<number | ''>(defaultAssignment?.admission_year ?? '')
  const [branch, setBranch] = useState<string | ''>(defaultAssignment?.branch_code ?? '')
  
  const isRepresentative = userContext?.role === 'representative'
  const assignments = userContext?.representativeAssignments || []

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/reminders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, due_date: dueDate, status, year, branch }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create')
      setOpen(false)
      onCreated()
      setTitle(''); setDueDate(''); setStatus(''); setYear(''); setBranch('')
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Reminder</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
          <div>
            <Label>Status</Label>
            <Input value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                    // Representatives can only create for their assigned years
                    assignments.map((assignment) => (
                      <SelectItem key={assignment.admission_year} value={String(assignment.admission_year)}>
                        {assignment.admission_year} Batch
                      </SelectItem>
                    ))
                  ) : (
                    // Admins can create for any year
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
                    // Representatives can only create for their assigned branches
                    assignments.map((assignment) => (
                      <SelectItem key={assignment.branch_code} value={assignment.branch_code}>
                        {assignment.branch_code}
                      </SelectItem>
                    ))
                  ) : (
                    // Admins can create for any branch
                    <>
                      <SelectItem value="none">None</SelectItem>
                      {['CSE','AIML','DS','AI','ECE','EEE','MEC','CE'].map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
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


