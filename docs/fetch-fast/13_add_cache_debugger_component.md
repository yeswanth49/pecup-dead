### Task 13: Add cache debugger component for development (`components/CacheDebugger.tsx`)

- **Objective**: Provide a dev-only widget to inspect and clear caches.

- **Files to add/edit**:
  - Add: `components/CacheDebugger.tsx`

- **Implementation steps**:
  1. Mark `'use client'`. Early-return `null` if `process.env.NODE_ENV !== 'development'`.
  2. Show a small toggle button. When open, display status of caches and a "Clear All" button.
  3. Use cache classes: `ProfileCache`, `StaticCache`, `SubjectsCache`, `DynamicCache`.

- **Validation criteria**:
  - Visible only in development.
  - Clear All removes entries from storage.

- **Completion checklist**:
  - [x] Component renders in dev
  - [x] Clear All works
