### Task 05: Update profile context (`lib/enhanced-profile-context.tsx`)

- **Objective**: Implement `ProfileProvider` and `useProfile` using the bulk API and caches for fast loads.

- **Files to add/edit**:
  - Add: `lib/enhanced-profile-context.tsx`

- **Implementation steps**:
  1. Mark file `'use client'` and set up React context with state for `profile, subjects, staticData, dynamicData, loading, error` and actions.
  2. On mount, if authenticated, read caches (`ProfileCache`, `StaticCache`, `SubjectsCache`, `DynamicCache`). If any present, hydrate state and background-fetch; else show loading and fetch.
  3. Implement `fetch('/api/bulk-academic-data')` and update state and caches.
  4. Implement `refreshProfile`, `refreshSubjects`, and `forceRefresh` clearing relevant caches before fetching.
  5. Export `ProfileProvider` and `useProfile`.

- **Validation criteria**:
  - Background refresh when cache present; loading spinner only when necessary.
  - Caches updated after network response.

- **Completion checklist**:
  - [ ] File exists and compiles
  - [ ] Context values exposed and used by components
  - [ ] Refresh functions working

- **Rollback**:
  - Remove provider usage and delete file.
