### Task 04: Verify cache utilities work in browser

- **Objective**: Ensure `lib/simple-cache.ts` classes set/get/clear correctly and honor TTLs.

- **Pre-reqs**:
  - App builds and runs.

- **Steps**:
  1. Open app, authenticate.
  2. Open DevTools → Application → Storage.
  3. Trigger code paths that call `ProfileCache.set`, `StaticCache.set`, `SubjectsCache.set`, `DynamicCache.set` (e.g., after bulk fetch).
  4. Verify entries appear with expected keys and values.
  5. Manually corrupt a value to ensure `get` handles JSON parse errors and clears.
  6. Simulate TTL expiry by editing `expiresAt` for Static/Dynamic and reloading; entries should clear.

- **Validation criteria**:
  - No uncaught exceptions on SSR/CSR.
  - Entries persist and are cleared when TTLs expire.

- **Completion checklist**:
  - [ ] All caches observed in storage
  - [ ] Error handling verified
  - [ ] TTL behavior verified
