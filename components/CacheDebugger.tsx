'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ProfileCache, StaticCache, SubjectsCache, DynamicCache } from '@/lib/simple-cache'
import { useProfile } from '@/lib/enhanced-profile-context'
import { PerfMon } from '@/lib/performance-monitor'

type CacheStatus = {
  profile: { present: boolean; email?: string | null; id?: string | null }
  staticData: { present: boolean; keys?: string[] }
  dynamicData: { present: boolean }
  subjects: { present: boolean; count?: number; context?: { branch: string; year: number; semester: number } | null }
}

export function CacheDebugger() {
  const isDev = process.env.NODE_ENV === 'development'
  const { data: session } = useSession()
  const { profile } = useProfile()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<CacheStatus | null>(null)
  const [metrics, setMetrics] = useState(PerfMon.getSnapshot())
  const email = session?.user?.email ?? null

  const subjectsContext = useMemo(() => {
    if (profile && typeof profile.year === 'number' && profile.year > 0 && profile.branch && profile.semester) {
      return { branch: profile.branch, year: profile.year, semester: profile.semester }
    }
    return null
  }, [profile])

  const computeStatus = () => {
    try {
      const prof = email ? ProfileCache.get(email) : null
      const stat = StaticCache.get<any>()
      const dyn = DynamicCache.get<any>()
      const subs = subjectsContext
        ? SubjectsCache.get(subjectsContext.branch, subjectsContext.year, subjectsContext.semester)
        : null

      const s: CacheStatus = {
        profile: { present: !!prof, email, id: (prof as any)?.id ?? null },
        staticData: { present: !!stat, keys: stat ? Object.keys(stat as any) : [] },
        dynamicData: { present: !!dyn },
        subjects: {
          present: Array.isArray(subs) && subs.length > 0,
          count: Array.isArray(subs) ? subs.length : 0,
          context: subjectsContext
        }
      }
      setStatus(s)
      setMetrics(PerfMon.getSnapshot())
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('CacheDebugger status error:', e)
      setStatus(null)
    }
  }

  useEffect(() => {
    if (!open) return
    computeStatus()
    // Recompute when email/context changes while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, email, subjectsContext?.branch, subjectsContext?.year, subjectsContext?.semester])

  const clearAll = () => {
    try {
      ProfileCache.clear()
      StaticCache.clear()
      DynamicCache.clear()
      SubjectsCache.clearAll()
    } catch (_) {}
    computeStatus()
  }

  const resetMetrics = () => {
    PerfMon.reset()
    setMetrics(PerfMon.getSnapshot())
  }

  return isDev ? (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 50 }}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border bg-white/80 dark:bg-neutral-900/80 px-3 py-1 text-sm shadow hover:bg-white dark:hover:bg-neutral-900"
          aria-label="Open Cache Debugger"
        >
          Cache
        </button>
      )}
      {open && (
        <div className="w-80 max-w-[90vw] rounded-lg border bg-white dark:bg-neutral-900 shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="text-sm font-semibold">Cache Debugger</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Close
            </button>
          </div>
          <div className="px-3 py-2">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={computeStatus}
                className="rounded border px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={resetMetrics}
                className="rounded border px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                Reset Metrics
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <section className="rounded border p-2">
                <div className="font-medium mb-1">ProfileCache</div>
                <div><span className="text-muted-foreground">email:</span> {status?.profile.email ?? '—'}</div>
                <div><span className="text-muted-foreground">present:</span> {status?.profile.present ? 'yes' : 'no'}</div>
                <div><span className="text-muted-foreground">id:</span> {status?.profile.id ?? '—'}</div>
              </section>

              <section className="rounded border p-2">
                <div className="font-medium mb-1">StaticCache</div>
                <div><span className="text-muted-foreground">present:</span> {status?.staticData.present ? 'yes' : 'no'}</div>
                {status?.staticData.present && (
                  <div className="mt-1">
                    <div className="text-muted-foreground">keys:</div>
                    <div className="break-words">{(status.staticData.keys || []).slice(0, 8).join(', ') || '—'}</div>
                  </div>
                )}
              </section>

              <section className="rounded border p-2">
                <div className="font-medium mb-1">DynamicCache</div>
                <div><span className="text-muted-foreground">present:</span> {status?.dynamicData.present ? 'yes' : 'no'}</div>
              </section>

              <section className="rounded border p-2">
                <div className="font-medium mb-1">SubjectsCache</div>
                <div><span className="text-muted-foreground">context:</span> {subjectsContext ? `${subjectsContext.branch} • Y${subjectsContext.year} • S${subjectsContext.semester}` : '—'}</div>
                <div><span className="text-muted-foreground">present:</span> {status?.subjects.present ? 'yes' : 'no'}</div>
                {typeof status?.subjects.count === 'number' && (
                  <div><span className="text-muted-foreground">count:</span> {status?.subjects.count}</div>
                )}
              </section>

              <section className="rounded border p-2">
                <div className="font-medium mb-1">Performance</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className="text-muted-foreground">API calls:</div>
                  <div>{metrics.totalApiCalls}</div>
                  <div className="text-muted-foreground">Bulk calls:</div>
                  <div>{metrics.bulkApiCalls}</div>
                  <div className="text-muted-foreground">Last bulk ms:</div>
                  <div>{metrics.lastBulkFetchMs ?? '—'}</div>
                  <div className="text-muted-foreground">Avg bulk ms:</div>
                  <div>{metrics.averageBulkFetchMs ? Math.round(metrics.averageBulkFetchMs) : '—'}</div>
                  <div className="text-muted-foreground">Cache checks:</div>
                  <div>{metrics.cacheChecks}</div>
                  <div className="text-muted-foreground">Cache hits:</div>
                  <div>{metrics.cacheHits}</div>
                  <div className="text-muted-foreground">Hit rate:</div>
                  <div>{metrics.cacheHitRate !== null ? `${Math.round(metrics.cacheHitRate * 100)}%` : '—'}</div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : null
}

export default CacheDebugger


