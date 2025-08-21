'use client'

import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type Exam = { id: string; subject: string; exam_date: string; description?: string | null }

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

export function ExamsSection({ userContext }: { userContext: UserContext | null }) {
  const [items, setItems] = useState<Exam[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', '1')
    p.set('limit', '50')
    
    // For representatives, always filter by their assigned scope
    if (userContext?.role === 'representative' && userContext.representativeAssignments) {
      const assignment = userContext.representativeAssignments[0] // Use first assignment
      if (assignment) {
        p.set('year', String(assignment.admission_year))
        p.set('branch', assignment.branch_code)
      }
    }
    
    return p.toString()
  }, [userContext])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/exams?${query}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed')
      setItems(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [refreshIndex, query])

  async function handleDelete(id: string) {
    if (!confirm('Delete this exam?')) return
    const res = await fetch(`/api/admin/exams/${id}`, { method: 'DELETE' })
    if (res.ok) setRefreshIndex((i) => i + 1)
    else alert('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => setRefreshIndex((i) => i + 1)} disabled={loading}>Refresh</Button>
        <CreateExamDialog onCreated={() => setRefreshIndex((i) => i + 1)} userContext={userContext} />
      </div>
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Exam Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.subject}</TableCell>
                <TableCell>{new Date(r.exam_date).toLocaleDateString()}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'No exams found'}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CreateExamDialog({ onCreated, userContext }: { onCreated: () => void; userContext: UserContext | null }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [examDate, setExamDate] = useState('')
  
  // For representatives, add year and branch fields
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
      const payload: any = { 
        subject, 
        exam_date: examDate 
      }
      
      // For representatives, include year and branch
      if (isRepresentative) {
        if (year) payload.year = year
        if (branch) payload.branch = branch
      }
      
      const res = await fetch('/api/admin/exams', { 
        method: 'POST', 
        headers: { 'content-type': 'application/json' }, 
        body: JSON.stringify(payload) 
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create')
      setOpen(false)
      onCreated()
      setSubject(''); setExamDate(''); setYear(''); setBranch('')
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
          <DialogTitle>Create Exam</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div>
            <Label>Exam Date</Label>
            <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
          </div>
          
          {/* Show year and branch fields for representatives */}
          {isRepresentative && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Year (Admission Batch)</Label>
                <Select 
                  value={year ? String(year) : 'none'} 
                  onValueChange={(v) => setYear(v === 'none' ? '' : Number(v))}
                  disabled={assignments.length === 1}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.admission_year} value={String(assignment.admission_year)}>
                        {assignment.admission_year} Batch
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select 
                  value={branch || 'none'} 
                  onValueChange={(v) => setBranch(v === 'none' ? '' : v)}
                  disabled={assignments.length === 1}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.branch_code} value={assignment.branch_code}>
                        {assignment.branch_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


