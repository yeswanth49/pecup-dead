### Task 07: Update protected layout to use new context

- **Objective**: Wrap protected routes with `ProfileProvider` and surface a refresh control.

- **Files to edit**:
  - Edit: `app/(protected)/layout.tsx`

- **Implementation steps**:
  1. Import `ProfileProvider` and `RefreshButton`.
  2. Wrap layout children with `ProfileProvider` and place `RefreshButton` in the header area.
  3. Ensure SSR/async layout compatibility.

- **Validation criteria**:
  - No hydration mismatch.
  - Child pages can call `useProfile`.

- **Completion checklist**:
  - [ ] Layout compiles and renders
  - [ ] `useProfile` accessible in child components

- **Rollback**:
  - Revert layout edits.
