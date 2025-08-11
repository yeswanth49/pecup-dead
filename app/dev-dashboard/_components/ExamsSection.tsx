'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type Exam = { id: string; subject: string; exam_date: string; description?: string | null }

export function ExamsSection() {
  const [items, setItems] = useState<Exam[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/exams?page=1&limit=50`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed')
      setItems(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [refreshIndex])

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
        <CreateExamDialog onCreated={() => setRefreshIndex((i) => i + 1)} />
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

function CreateExamDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [examDate, setExamDate] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/exams', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject, exam_date: examDate }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create')
      setOpen(false)
      onCreated()
      setSubject(''); setExamDate('')
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


