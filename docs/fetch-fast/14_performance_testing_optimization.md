### Task 14: Performance testing and optimization

- **Objective**: Measure and improve load times, API counts, and cache hit rates.

- **Steps**:
  1. Baseline: Record API calls per load, average load time, and cache hit rate before changes.
  2. After implementation, use DevTools Performance and Network to measure improvements.
  3. Identify slow queries in `/api/bulk-academic-data`; consider index tweaks or query reductions.
  4. Optimize component renders using memoization if needed.

- **Validation criteria**:
  - API calls reduced to 1 on first load and 0 on cached reload.
  - Measurable load-time reduction per plan goals.

- **Completion checklist**:
  - [x] Metrics collected
  - [x] Optimizations applied and verified

---

Notes:
- A lightweight client metrics module is available at `lib/performance-monitor.ts`.
- The dev cache panel `components/CacheDebugger.tsx` now shows:
  - API calls, bulk calls, last/avg bulk fetch time
  - Cache checks, hits, and hit-rate
- The bulk endpoint `app/api/bulk-academic-data/route.ts` returns `meta.timings` with per-section durations: `profileMs`, `subjectsMs`, `staticMs`, `dynamicMs`.
- Background refresh is skipped when caches are present except when dynamic cache is missing/expired.
