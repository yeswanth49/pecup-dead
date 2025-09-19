### Task 17: Add performance monitoring (`lib/performance-monitor.ts`)

- **Objective**: Track client-side operation timings and cache hit rates.

- **Files to add/edit**:
  - Add: `lib/performance-monitor.ts`

- **Implementation steps**:
  1. Implement a simple `PerformanceMonitor` with `startOperation` timers and internal ring buffer of last 100 metrics.
  2. Expose helpers to get metrics, average load time, and cache hit rate.
  3. Optionally log to console for quick feedback.

- **Validation criteria**:
  - Timers accurately measure operations; logs appear in console.

- **Completion checklist**:
  - [ ] File exists and compiles
  - [ ] Metrics gather during fetch flows
