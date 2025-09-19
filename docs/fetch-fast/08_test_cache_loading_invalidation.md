### Task 08: Test cache loading and invalidation

- **Objective**: Confirm that initial loads use cache when available and that invalidations trigger network fetches.

- **Steps**:
  1. With no caches, load a protected page; observe loading state and network request to `/api/bulk-academic-data`.
  2. Reload page; verify instant render from caches and background refresh without loading spinner.
  3. Trigger `refreshProfile`; confirm `ProfileCache` cleared and network refetch.
  4. Trigger `refreshSubjects`; confirm `SubjectsCache` for context cleared and network refetch.
  5. Trigger `forceRefresh`; confirm all caches cleared and repopulated.

- **Validation criteria**:
  - Background refresh occurs only when caches exist.
  - Cache entries updated after network response.

- **Completion checklist**:
  - [ ] Behavior observed and consistent
  - [ ] No console errors
