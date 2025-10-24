### Task 12: Test cross-tab synchronization

- **Objective**: Ensure cache behaviors are sensible across multiple tabs/windows.

- **Steps**:
  1. Open two tabs of the protected app simultaneously (e.g., Home and `Dev Cache Test`).
  2. In Tab A, click the Refresh button (calls `forceRefresh`).
     - Expected: Tab B updates without a full reload within ~100–300ms (profile/static/dynamic/subjects state hydrates).
  3. In Tab B, open DevTools → Application → Storage and delete `dynamic_data_cache`.
     - Switch back to Tab B and focus it (visibility change) or reload.
     - Expected: Background refresh occurs; Tab A remains stable (no loops).
  4. Corrupt JSON in Tab A via Dev Cache Test buttons.
     - Reload Tab A: corrupted caches should be cleared; Tab B should remain healthy.
  5. Disable BroadcastChannel (simulate legacy browser): in Console, set `window.BroadcastChannel = undefined` then repeat step 2.
     - Expected: Fallback via `storage` event still syncs caches across tabs.

- **Validation criteria**:
  - Independent tabs do not corrupt each other's state.
  - Subsequent loads benefit from warmed caches.
  - No cross-tab infinite loops; only the initiating tab fetches, others hydrate from broadcast.

- **Completion checklist**:
  - [ ] Multi-tab behavior observed
  - [ ] No race conditions detected
  - [ ] Fallback storage-event sync verified
