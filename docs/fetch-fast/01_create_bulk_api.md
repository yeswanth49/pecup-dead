### Task 01: Create bulk API endpoint (`app/api/bulk-academic-data/route.ts`)

- **Objective**: Implement a single API endpoint that returns profile, subjects, static, and dynamic academic data in one response as outlined in `docs/fetch-fast.md`.

- **Pre-reqs**:
  - NextAuth configured at `app/api/auth/[...nextauth]/route.ts`.
  - Supabase admin client via `lib/supabase.ts` (`createSupabaseAdmin`).
  - `lib/academic-config.ts` available.

- **Files to add/edit**:
  - Add: `app/api/bulk-academic-data/route.ts`

- **Implementation steps**:
  1. Create a Next.js route handler `GET` that authenticates the user via `getServerSession(authOptions)`. Return 401 on missing email.
  2. Using `createSupabaseAdmin()`, query `profiles` with related `branches`, `years`, `semesters` as per the plan. Return 404 if not found.
  3. Compute `currentYear`, `branchCode`, `semester` using `AcademicConfigManager`.
  4. In parallel (`Promise.all`), fetch subjects for the context (via `subject_offerings` → `subjects`), static data (`branches`, `years`, `semesters`), and dynamic data (`recent_updates`, `exams`, `reminders`) with filters and limits as specified.
  5. Return a normalized JSON payload matching the plan: `{ profile, subjects, static, dynamic, timestamp }`.
  6. Handle and log errors; respond 500 on failure.

- **Validation criteria**:
  - Authenticated request returns 200 with all keys present.
  - Unauthenticated request returns 401.
  - Missing profile returns 404.
  - Subjects array respects ordering and user context.

- **Completion checklist**:
  - [ ] File exists and compiles
  - [ ] Returns expected schema
  - [ ] Proper error handling and logging

- **Rollback**:
  - Delete `app/api/bulk-academic-data/route.ts`.
