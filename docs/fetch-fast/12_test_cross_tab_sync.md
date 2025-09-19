### Task 12: Test cross-tab synchronization

- **Objective**: Ensure cache behaviors are sensible across multiple tabs/windows.

- **Steps**:
  1. Open two tabs of the protected app simultaneously.
  2. Trigger `forceRefresh` in Tab A; verify Tab B renders quickly on reload thanks to new caches.
  3. Simulate dynamic cache expiry in Tab B by clearing sessionStorage → reload; ensure background refresh occurs.
  4. Confirm no infinite loops or race conditions.

- **Validation criteria**:
  - Independent tabs do not corrupt each other's state.
  - Subsequent loads benefit from warmed caches.

- **Completion checklist**:
  - [ ] Multi-tab behavior observed
  - [ ] No race conditions detected
