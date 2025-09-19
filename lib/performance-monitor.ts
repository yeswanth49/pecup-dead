'use client'

type OperationRecord = {
  name: string
  durationMs: number
  at: number
  extra?: Record<string, unknown>
}

type MetricsSnapshot = {
  totalApiCalls: number
  bulkApiCalls: number
  averageBulkFetchMs: number | null
  lastBulkFetchMs: number | null
  cacheChecks: number
  cacheHits: number
  cacheHitRate: number | null
  recentOperations: OperationRecord[]
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null

  static getInstance(): PerformanceMonitor {
    if (!this.instance) this.instance = new PerformanceMonitor()
    return this.instance
  }

  private operations: OperationRecord[] = []
  private maxOperations = 100

  private totalApiCalls = 0
  private bulkApiCalls = 0
  private bulkDurations: number[] = []
  private lastBulkMs: number | null = null

  private cacheChecks = 0
  private cacheHits = 0

  startOperation(name: string, extra?: Record<string, unknown>) {
    const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
    const at = Date.now()
    return () => {
      const end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      const durationMs = end - start
      this.record(name, durationMs, extra, at)
      return durationMs
    }
  }

  record(name: string, durationMs: number, extra?: Record<string, unknown>, at?: number) {
    const op: OperationRecord = { name, durationMs, at: at ?? Date.now(), extra }
    this.operations.push(op)
    if (this.operations.length > this.maxOperations) this.operations.shift()

    if (name === 'api:bulk-fetch') {
      this.bulkApiCalls += 1
      this.lastBulkMs = durationMs
      this.bulkDurations.push(durationMs)
      if (this.bulkDurations.length > 50) this.bulkDurations.shift()
    }
  }

  incrementApiCalls(count = 1) {
    this.totalApiCalls += count
  }

  recordCacheCheck(hit: boolean) {
    this.cacheChecks += 1
    if (hit) this.cacheHits += 1
  }

  reset() {
    this.operations = []
    this.totalApiCalls = 0
    this.bulkApiCalls = 0
    this.bulkDurations = []
    this.lastBulkMs = null
    this.cacheChecks = 0
    this.cacheHits = 0
  }

  getSnapshot(): MetricsSnapshot {
    const averageBulkFetchMs = this.bulkDurations.length
      ? this.bulkDurations.reduce((a, b) => a + b, 0) / this.bulkDurations.length
      : null
    const cacheHitRate = this.cacheChecks > 0 ? this.cacheHits / this.cacheChecks : null
    return {
      totalApiCalls: this.totalApiCalls,
      bulkApiCalls: this.bulkApiCalls,
      averageBulkFetchMs,
      lastBulkFetchMs: this.lastBulkMs,
      cacheChecks: this.cacheChecks,
      cacheHits: this.cacheHits,
      cacheHitRate,
      recentOperations: this.operations.slice().reverse(),
    }
  }
}

export const PerfMon = PerformanceMonitor.getInstance()


