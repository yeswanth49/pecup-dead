### Task 09: Add visibility change handler for background refresh

- **Objective**: Refresh dynamic data when the tab becomes visible and the dynamic cache has expired.

- **Files to edit**:
  - Edit: `lib/enhanced-profile-context.tsx`

- **Implementation steps**:
  1. Inside `ProfileProvider`, add an effect listening to `document.visibilitychange`.
  2. When `document.visibilityState === 'visible'` and `profile` exists, check `DynamicCache.get()`.
  3. If no valid dynamic cache, call `fetchBulkData(false)` to refresh without toggling loading.
  4. Clean up the event listener on unmount.

- **Validation criteria**:
  - Switching away and back causes a background refresh only when dynamic cache expired.

- **Completion checklist**:
  - [ ] Effect added and working
  - [ ] No duplicate listeners or memory leaks
