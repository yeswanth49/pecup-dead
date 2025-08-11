'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Admin = { id: string; email: string; role: 'admin'|'superadmin'; created_at: string }

export function AdminsSection() {
  const [items, setItems] = useState<Admin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/admins?page=1&limit=50`)
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

  async function remove(email: string) {
    if (!confirm(`Remove ${email}?`)) return
    const res = await fetch(`/api/admin/admins/${encodeURIComponent(email)}`, { method: 'DELETE' })
    if (res.ok) setRefreshIndex((i) => i + 1); else alert('Failed')
  }
  async function changeRole(email: string, role: 'admin'|'superadmin') {
    const res = await fetch(`/api/admin/admins/${encodeURIComponent(email)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) })
    if (res.ok) setRefreshIndex((i) => i + 1); else alert('Failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => setRefreshIndex((i) => i + 1)} disabled={loading}>Refresh</Button>
        <CreateAdminForm onCreated={() => setRefreshIndex((i) => i + 1)} />
      </div>
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.email}</TableCell>
                <TableCell>
                  <Select value={r.role} onValueChange={(v) => changeRole(r.email, v as any)}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="superadmin">superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button variant="destructive" size="sm" onClick={() => remove(r.email)}>Remove</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'No admins found'}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CreateAdminForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin'|'superadmin'>('admin')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/admins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to add admin')
      onCreated(); setEmail(''); setRole('admin')
    } catch (e: any) {
      setError(e?.message || 'Failed to add admin')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <div>
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <Label>Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as 'admin'|'superadmin')}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="superadmin">superadmin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add'}</Button>
      {error && <div className="text-sm text-red-500">{error}</div>}
    </form>
  )
}


