### Task 18: Integration testing

- **Objective**: Add tests for the bulk API handler with mocks for auth and Supabase.

- **Files to add/edit**:
  - Add: `__tests__/bulk-fetch.test.ts`

- **Implementation steps**:
  1. Mock `next-auth`'s `getServerSession` and `lib/supabase`'s `createSupabaseAdmin`.
  2. Test 200 path (authenticated, happy path) returns keys.
  3. Test 401 when unauthenticated.
  4. Test 500 when Supabase throws.

- **Validation criteria**:
  - Tests compile and run; assertions cover main branches.

- **Completion checklist**:
  - [ ] Tests added
  - [ ] All tests pass
