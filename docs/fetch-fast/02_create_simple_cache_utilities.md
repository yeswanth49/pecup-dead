### Task 02: Create simple cache utilities (`lib/simple-cache.ts`)

- **Objective**: Implement client-side caches: `ProfileCache`, `StaticCache`, `SubjectsCache`, `DynamicCache` per the plan to maximize cache hits and reduce API calls.

- **Files to add/edit**:
  - Add: `lib/simple-cache.ts`

- **Implementation steps**:
  1. Mark file `'use client'`.
  2. Implement `ProfileCache` using `sessionStorage` with user email guard and clear logic.
  3. Implement `StaticCache` using `localStorage` with 30-day TTL.
  4. Implement `SubjectsCache` using `localStorage` keyed by `branch_year_semester`, with manual invalidation helpers.
  5. Implement `DynamicCache` using `sessionStorage` with 10-minute TTL.
  6. Guard all storage access behind `typeof window !== 'undefined'` and try/catch with warnings.

- **Validation criteria**:
  - Methods `set/get/clear` exist and are type-safe enough for TS.
  - TTLs respected; expired entries are cleared.
  - Works in browser without throwing on SSR.

- **Completion checklist**:
  - [ ] File exists and compiles
  - [ ] All four caches implemented
  - [ ] Storage guards and error handling present

- **Rollback**:
  - Delete `lib/simple-cache.ts`.
