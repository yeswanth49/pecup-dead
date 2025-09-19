### Task 10: Create cache invalidation hooks (`lib/cache-invalidation.ts`)

- **Objective**: Provide hooks to invalidate caches on profile update or semester change.

- **Files to add/edit**:
  - Add: `lib/cache-invalidation.ts`

- **Implementation steps**:
  1. Export `useProfileInvalidation` hook that imports `useProfile`.
  2. Implement `invalidateOnProfileUpdate` to clear `ProfileCache` and call `refreshProfile`.
  3. Implement `invalidateOnSemesterChange` to clear `SubjectsCache.clearAll()`, `ProfileCache.clear()`, then `refreshProfile`.
  4. Wrap callbacks with `useCallback` and proper deps.

- **Validation criteria**:
  - Calling functions triggers network fetch and state update.

- **Completion checklist**:
  - [ ] Hook file exists and compiles
  - [ ] Both invalidation functions work
