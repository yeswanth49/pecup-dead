### Task 06: Create refresh button component (`components/RefreshButton.tsx`)

- **Objective**: Provide a simple UI control to force-refresh all data and caches.

- **Files to add/edit**:
  - Add: `components/RefreshButton.tsx`

- **Implementation steps**:
  1. Mark `'use client'` and import `useProfile` from `lib/enhanced-profile-context`.
  2. Render a button that calls `forceRefresh` and shows a disabled "Refreshing..." state when `loading` is true.
  3. Keep styles minimal and consistent with existing UI.

- **Validation criteria**:
  - Clicking triggers a network fetch and cache reset.
  - Button disabled during refresh.

- **Completion checklist**:
  - [ ] Component renders inside protected layout
  - [ ] Force refresh works and caches repopulate

- **Rollback**:
  - Remove the component import and delete file.
