'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type RecentUpdate = { id: string; title: string; date?: string | null; description?: string | null }

export function RecentUpdatesSection() {
  const [items, setItems] = useState<RecentUpdate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/recent-updates?page=1&limit=50`)
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
    if (!confirm('Delete this update?')) return
    const res = await fetch(`/api/admin/recent-updates/${id}`, { method: 'DELETE' })
    if (res.ok) setRefreshIndex((i) => i + 1)
    else alert('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => setRefreshIndex((i) => i + 1)} disabled={loading}>Refresh</Button>
        <CreateRecentUpdateDialog onCreated={() => setRefreshIndex((i) => i + 1)} />
      </div>
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{r.date ? new Date(r.date).toLocaleDateString() : '-'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'No updates found'}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CreateRecentUpdateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/recent-updates', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, date: date || undefined, description: description || undefined })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create')
      setOpen(false)
      onCreated()
      setTitle(''); setDate(''); setDescription('')
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
          <DialogTitle>Create Update</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
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


