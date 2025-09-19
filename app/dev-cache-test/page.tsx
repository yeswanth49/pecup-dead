'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ProfileCache, StaticCache, SubjectsCache, DynamicCache } from '@/lib/simple-cache'

type BulkResponse<TStatic = unknown, TDynamic = unknown> = {
  profile?: {
    id: string
    roll_number?: string
    name?: string
    email: string
    section?: string
    role?: string
    year: number | null
    branch: string | null
    semester: number | null
  }
  subjects?: Array<{ id: string; code: string; name: string; resource_type?: string }>
  static?: TStatic
  dynamic?: TDynamic
  error?: string
}

export default function DevCacheTestPage() {
  const { status } = useSession()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [cacheStatus, setCacheStatus] = useState({
    profile: false,
    static: false,
    dynamic: false,
    subjects: false
  })

  const refreshStatus = () => {
    try {
      // Use safe getters; for profile we cannot know email without session, try to infer from stored value
      let hasProfile = false
      if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem('profile_cache')
        hasProfile = !!raw
      }
      const hasStatic = typeof window !== 'undefined' && !!localStorage.getItem('static_data_cache')
      const hasDynamic = typeof window !== 'undefined' && !!sessionStorage.getItem('dynamic_data_cache')
      // Heuristic: if any localStorage key starts with subjects_ then we consider subjects cached
      let hasSubjects = false
      if (typeof window !== 'undefined') {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('subjects_')) { hasSubjects = true; break }
        }
      }
      setCacheStatus({ profile: hasProfile, static: hasStatic, dynamic: hasDynamic, subjects: hasSubjects })
    } catch (_) {}
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  const populateFromBulk = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/bulk-academic-data', { cache: 'no-store' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as BulkResponse
        throw new Error(body?.error || `Request failed: ${res.status}`)
      }
      const data = (await res.json()) as BulkResponse
      if (!data?.profile?.email) {
        throw new Error('No profile email returned; cannot seed ProfileCache')
      }

      // Write caches
      ProfileCache.set(data.profile.email, data.profile)
      if (data.static) StaticCache.set(data.static)
      if (data.dynamic) DynamicCache.set(data.dynamic)
      if (data.profile.branch && data.profile.year && data.profile.semester && data.subjects) {
        SubjectsCache.set(data.profile.branch, data.profile.year, data.profile.semester, data.subjects)
      }

      setMessage('Caches populated from bulk API')
      refreshStatus()
    } catch (e: any) {
      setMessage(e?.message || 'Failed to populate from bulk API')
    } finally {
      setLoading(false)
    }
  }

  const corruptJson = (key: 'profile' | 'static' | 'dynamic') => {
    try {
      if (typeof window === 'undefined') return
      if (key === 'profile') sessionStorage.setItem('profile_cache', '{bad-json')
      if (key === 'static') localStorage.setItem('static_data_cache', '{bad-json')
      if (key === 'dynamic') sessionStorage.setItem('dynamic_data_cache', '{bad-json')
      setMessage(`Corrupted ${key} cache JSON. Reload to verify auto-clear.`)
      refreshStatus()
    } catch (_) {}
  }

  const expireTtls = () => {
    try {
      if (typeof window === 'undefined') return
      const nowPast = Date.now() - 1000
      const staticRaw = localStorage.getItem('static_data_cache')
      if (staticRaw) {
        const obj = JSON.parse(staticRaw)
        obj.expiresAt = nowPast
        localStorage.setItem('static_data_cache', JSON.stringify(obj))
      }
      const dynamicRaw = sessionStorage.getItem('dynamic_data_cache')
      if (dynamicRaw) {
        const obj = JSON.parse(dynamicRaw)
        obj.expiresAt = nowPast
        sessionStorage.setItem('dynamic_data_cache', JSON.stringify(obj))
      }
      setMessage('Set expiresAt in the past for static/dynamic. Reload to verify eviction.')
      refreshStatus()
    } catch (e) {
      setMessage('Failed to set TTLs')
    }
  }

  const clearAll = () => {
    try {
      ProfileCache.clear()
      StaticCache.clear()
      DynamicCache.clear()
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(k => { if (k.startsWith('subjects_')) localStorage.removeItem(k) })
      }
      setMessage('Cleared all caches')
      refreshStatus()
    } catch (_) {}
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">Dev Cache Test</h1>
      <p className="text-sm text-muted-foreground">
        Use this page to populate and verify browser caches. Recommended: Chrome DevTools → Application → Storage.
      </p>

      {status === 'unauthenticated' && (
        <div className="p-3 rounded border text-sm">You are not authenticated. Sign in first, then click Populate.</div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={populateFromBulk} disabled={loading} className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50">
          {loading ? 'Loading…' : 'Populate from Bulk API'}
        </button>
        <button onClick={() => corruptJson('profile')} className="px-3 py-1 rounded bg-yellow-600 text-white">Corrupt Profile JSON</button>
        <button onClick={() => corruptJson('static')} className="px-3 py-1 rounded bg-yellow-700 text-white">Corrupt Static JSON</button>
        <button onClick={() => corruptJson('dynamic')} className="px-3 py-1 rounded bg-yellow-800 text-white">Corrupt Dynamic JSON</button>
        <button onClick={expireTtls} className="px-3 py-1 rounded bg-orange-600 text-white">Set TTLs Expired</button>
        <button onClick={clearAll} className="px-3 py-1 rounded bg-red-600 text-white">Clear All</button>
        <button onClick={refreshStatus} className="px-3 py-1 rounded bg-gray-700 text-white">Refresh Status</button>
      </div>

      {message && <div className="text-sm text-muted-foreground">{message}</div>}

      <div className="border rounded p-4">
        <h2 className="font-semibold mb-2">Cache Status</h2>
        <ul className="text-sm space-y-1">
          <li>Profile (sessionStorage: profile_cache): {cacheStatus.profile ? '✅' : '❌'}</li>
          <li>Static (localStorage: static_data_cache): {cacheStatus.static ? '✅' : '❌'}</li>
          <li>Dynamic (sessionStorage: dynamic_data_cache): {cacheStatus.dynamic ? '✅' : '❌'}</li>
          <li>Subjects (localStorage: subjects_...): {cacheStatus.subjects ? '✅' : '❌'}</li>
        </ul>
      </div>

      <div className="text-sm text-muted-foreground space-y-2">
        <p>Validation steps:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click "Populate from Bulk API" → verify keys under Application → Storage.</li>
          <li>Click any "Corrupt ... JSON" → reload → entry should auto-clear, no console errors.</li>
          <li>Click "Set TTLs Expired" → reload → static/dynamic entries should be evicted.</li>
        </ol>
      </div>
    </div>
  )
}


