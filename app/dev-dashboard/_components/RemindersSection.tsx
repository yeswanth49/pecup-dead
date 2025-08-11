'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type Reminder = { id: string; title: string; due_date: string; status?: string | null; year?: number | null; branch?: string | null }

export function RemindersSection() {
  const [items, setItems] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [status, setStatus] = useState<string>('')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', '1')
    p.set('limit', '50')
    if (status) p.set('status', status)
    return p.toString()
  }, [status])

  async function load() {
    setLoading(true)
    setError(null)
    try {
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
          <Button variant="secondary" onClick={() => setRefreshIndex((i) => i + 1)} disabled={loading}>Refresh</Button>
          <CreateReminderDialog onCreated={() => setRefreshIndex((i) => i + 1)} />
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

function CreateReminderDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/reminders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, due_date: dueDate, status }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create')
      setOpen(false)
      onCreated()
      setTitle(''); setDueDate(''); setStatus('')
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


