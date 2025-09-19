### Task 15: Error handling improvements

- **Objective**: Harden the system against failures with graceful UX and logs.

- **Areas**:
  - Bulk API: return structured error messages and appropriate status codes.
  - Context: set `error` state and show non-blocking UI messages.
  - Caches: fail-safe on parse/storage errors and clear invalid entries.

- **Steps**:
  1. Ensure bulk API catches and logs errors, returns 500 with message.
  2. In context, surface `error` and render a small inline alert where appropriate.
  3. In caches, wrap JSON operations in try/catch and clear on failure.

- **Validation criteria**:
  - User sees errors without app crash.
  - Console logs contain actionable context.

- **Completion checklist**:
  - [ ] API returns consistent error shape
  - [ ] UI displays errors unobtrusively
