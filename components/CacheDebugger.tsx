'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ProfileCache, StaticCache, SubjectsCache, DynamicCache, ResourcesCache } from '@/lib/simple-cache'
import { useProfile } from '@/lib/enhanced-profile-context'
import { PerfMon } from '@/lib/performance-monitor'

type CacheStatus = {
  profile: { present: boolean; storage: string; email?: string | null; id?: string | null }
  staticData: { present: boolean; storage: string; keys?: string[] }
  dynamicData: { present: boolean; storage: string }
  subjects: { present: boolean; storage: string; count?: number; context?: { branch: string; year: number; semester: number } | null }
  bulkResources: { present: boolean; storage: string; subjects?: string[]; totalCount?: number }
  resourcesCache: { present: boolean; storage: string; count?: number }
}

export function CacheDebugger() {
  const isDev = process.env.NODE_ENV === 'development'
  const { data: session } = useSession()
  const { profile, resources: bulkResources } = useProfile()
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
      const stat = StaticCache.get() as any
      const dyn = DynamicCache.get() as any
      const subs = subjectsContext
        ? SubjectsCache.get(subjectsContext.branch, subjectsContext.year, subjectsContext.semester)
        : null

      // Check resources cache (individual page cache)
      const resourcesKeys = Object.keys(localStorage).filter(key => key.startsWith('resources_'))
      const resourcesPresent = resourcesKeys.length > 0

      // Check bulk resources from context
      let bulkResourcesSubjects: string[] = []
      let bulkResourcesTotal = 0
      if (bulkResources && typeof bulkResources === 'object') {
        bulkResourcesSubjects = Object.keys(bulkResources)
        bulkResourcesTotal = Object.values(bulkResources).reduce((sum, subj) => {
          if (typeof subj === 'object' && subj !== null) {
            return sum + Object.values(subj).reduce((catSum, resources) => {
              return catSum + (Array.isArray(resources) ? resources.length : 0)
            }, 0)
          }
          return sum
        }, 0)
      }

      const s: CacheStatus = {
        profile: {
          present: !!prof,
          storage: 'localStorage',
          email,
          id: (prof as any)?.id ?? null
        },
        staticData: {
          present: !!stat,
          storage: 'localStorage',
          keys: stat ? Object.keys(stat as any) : []
        },
        dynamicData: {
          present: !!dyn,
          storage: 'localStorage'
        },
        subjects: {
          present: Array.isArray(subs) && subs.length > 0,
          storage: 'localStorage',
          count: Array.isArray(subs) ? subs.length : 0,
          context: subjectsContext
        },
        bulkResources: {
          present: bulkResourcesSubjects.length > 0,
          storage: 'Context (from bulk fetch)',
          subjects: bulkResourcesSubjects,
          totalCount: bulkResourcesTotal
        },
        resourcesCache: {
          present: resourcesPresent,
          storage: 'localStorage',
          count: resourcesKeys.length
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
  }, [open, email, subjectsContext?.branch, subjectsContext?.year, subjectsContext?.semester, bulkResources])

  const clearAll = () => {
    try {
      ProfileCache.clear()
      StaticCache.clear()
      DynamicCache.clear()
      SubjectsCache.clearAll()
      ResourcesCache.clearAll()
    } catch (_) { }
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
        <div className="w-80 max-w-[90vw] max-h-[80vh] overflow-y-auto rounded-lg border bg-white dark:bg-neutral-900 shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2 sticky top-0 bg-white dark:bg-neutral-900">
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
                <div><span className="text-muted-foreground">storage:</span> {status?.profile.storage}</div>
                <div><span className="text-muted-foreground">email:</span> {status?.profile.email ?? '—'}</div>
                <div><span className="text-muted-foreground">present:</span> {status?.profile.present ? 'yes' : 'no'}</div>
                <div><span className="text-muted-foreground">id:</span> {status?.profile.id ?? '—'}</div>
              </section>

              <section className="rounded border p-2">
                <div className="font-medium mb-1">StaticCache</div>
                <div><span className="text-muted-foreground">storage:</span> {status?.staticData.storage}</div>
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
                <div><span className="text-muted-foreground">storage:</span> {status?.dynamicData.storage}</div>
                <div><span className="text-muted-foreground">present:</span> {status?.dynamicData.present ? 'yes' : 'no'}</div>
              </section>

              <section className="rounded border p-2">
                <div className="font-medium mb-1">SubjectsCache</div>
                <div><span className="text-muted-foreground">storage:</span> {status?.subjects.storage}</div>
                <div><span className="text-muted-foreground">context:</span> {subjectsContext ? `${subjectsContext.branch} • Y${subjectsContext.year} • S${subjectsContext.semester}` : '—'}</div>
                <div><span className="text-muted-foreground">present:</span> {status?.subjects.present ? 'yes' : 'no'}</div>
                {typeof status?.subjects.count === 'number' && (
                  <div><span className="text-muted-foreground">count:</span> {status?.subjects.count}</div>
                )}
              </section>

              <section className="rounded border p-2 bg-blue-50/50 dark:bg-blue-950/20">
                <div className="font-medium mb-1">Bulk Resources (Context)</div>
                <div><span className="text-muted-foreground">source:</span> {status?.bulkResources.storage}</div>
                <div><span className="text-muted-foreground">present:</span> {status?.bulkResources.present ? 'yes' : 'no'}</div>
                {status?.bulkResources.present && (
                  <>
                    <div><span className="text-muted-foreground">subjects:</span> {status.bulkResources.subjects?.join(', ') || '—'}</div>
                    <div><span className="text-muted-foreground">total resources:</span> {status.bulkResources.totalCount}</div>
                  </>
                )}
              </section>

              <section className="rounded border p-2">
                <div className="font-medium mb-1">ResourcesCache (Individual Pages)</div>
                <div><span className="text-muted-foreground">storage:</span> {status?.resourcesCache.storage}</div>
                <div><span className="text-muted-foreground">present:</span> {status?.resourcesCache.present ? 'yes' : 'no'}</div>
                {typeof status?.resourcesCache.count === 'number' && (
                  <div><span className="text-muted-foreground">cache keys:</span> {status?.resourcesCache.count}</div>
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

