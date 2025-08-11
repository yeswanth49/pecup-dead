'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Settings = { drive_folder_id?: string | null; storage_bucket: string; pdf_to_drive: boolean; non_pdf_to_storage: boolean }

export function SettingsSection() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load settings')
      setSettings(json)
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(settings) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save settings')
      setSettings(json)
      alert('Saved')
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) return <div>Loading…</div>

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Google Drive Folder ID</Label>
          <Input value={settings.drive_folder_id || ''} onChange={(e) => setSettings((s) => ({ ...(s as Settings), drive_folder_id: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Storage Bucket</Label>
          <Input value={settings.storage_bucket} onChange={(e) => setSettings((s) => ({ ...(s as Settings), storage_bucket: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        <Button variant="secondary" onClick={load} disabled={loading}>Reload</Button>
      </div>
    </div>
  )
}


