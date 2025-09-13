## Identity Consolidation: Make `profiles` Canonical

Goal: Consolidate identity and roles onto `profiles` as the single source of truth. Keep representative and superadmin roles code-only, no UI changes. Apply changes via Supabase CLI SQL migrations only.

---

### A) Discovery (current usages)

- **Reads from `students`**:
  - `app/api/profile/route.ts`: GET/POST use `students` for academic fields and relations; falls back to `profiles` for role.
  - `app/(protected)/layout.tsx`: gate to `/onboarding` if no `students` row exists for the user.
  - `app/api/resources/route.ts` (public resources): infers `branch_id/year_id/semester_id` from the logged-in user's `students` row if query params missing; selects `uploader:students(...)` relation.
  - `app/api/admin/resources/route.ts`: resolves `uploader_id` by looking up `students.id` by email.
  - `app/api/semester-promotion/route.ts`: selects and updates `students` by `branch_id/year_id/semester_id`.

- **Reads from `admins`**:
  - `lib/admin-auth.ts` + `lib/auth-permissions.ts`: `requireAdmin`/gating reads `admins`.
  - `app/api/admin/bootstrap-superadmin/route.ts`: counts and inserts into `admins`.
  - `app/api/admin/admins/*`: list/insert/patch/delete `admins`.
  - `app/api/admin/resources/*`: checks `admins` and `admin_scopes` for scope; uses `created_by` FK referencing `admins.id`.
  - `lib/role-management.ts`: assigns roles by updating `profiles.role` then upserts into `admins`.

- **Reads from `profiles` (already canonical-ish)**:
  - Roles and counts already use `profiles` (e.g., `app/api/users-count/route.ts`).
  - `lib/auth-permissions.ts` gets role from `profiles.role` and augments with `students` academic fields when present.

Data needed by code paths:
- Academic fields for a user: `branch_id`, `year_id`, `semester_id`, `section`, `roll_number` (+ joins to `branches/years/semesters`). Today sourced from `students` or legacy fields on `profiles` (`branch` code, numeric `year`).
- Admin role truth: currently duplicated in `admins` and `profiles.role`.
- Admin scope: stored in `admin_scopes` keyed by `admins.id`.

Conclusion:
- Keep `profiles` as canonical for identity and roles.
- Backfill academic ID fields to `profiles` and provide temporary compatibility views so existing `students`/`admins` reads work during transition.

---

### B) Data audit SQL (read-only)

Run in dev/staging via Supabase CLI psql:

```sql
-- Core counts
SELECT COUNT(*) AS profiles_count FROM profiles;
SELECT COUNT(*) AS students_count FROM students;
SELECT COUNT(*) AS admins_count   FROM admins;

-- Email uniqueness and nulls on profiles
SELECT COUNT(*) AS profiles_email_nulls FROM profiles WHERE email IS NULL;
SELECT COUNT(*) AS profiles_email_dupes FROM (
  SELECT email, COUNT(*) FROM profiles GROUP BY email HAVING COUNT(*) > 1
) d;

-- Distinct email universe and overlaps
WITH p AS (SELECT DISTINCT lower(email) e FROM profiles),
     s AS (SELECT DISTINCT lower(email) e FROM students),
     a AS (SELECT DISTINCT lower(email) e FROM admins)
SELECT (SELECT COUNT(*) FROM p) AS p,
       (SELECT COUNT(*) FROM s) AS s,
       (SELECT COUNT(*) FROM a) AS a,
       (SELECT COUNT(*) FROM p JOIN s USING(e)) AS p_inter_s,
       (SELECT COUNT(*) FROM p JOIN a USING(e)) AS p_inter_a,
       (SELECT COUNT(*) FROM s JOIN a USING(e)) AS s_inter_a,
       (SELECT COUNT(*) FROM p FULL JOIN s USING(e) FULL JOIN a USING(e)) AS union_all;

-- Orphans needing backfill
SELECT s.* FROM students s LEFT JOIN profiles p ON lower(p.email) = lower(s.email) WHERE p.id IS NULL LIMIT 100;
SELECT a.* FROM admins   a LEFT JOIN profiles p ON lower(p.email) = lower(a.email) WHERE p.id IS NULL LIMIT 100;
```

If tables `students`/`admins` may not exist in dev, wrap with guards:
```sql
DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_name = 'students';
  IF FOUND THEN RAISE NOTICE 'students exists'; END IF;
END $$;
```

---

### C) Migration Stage A (transactional, reversible)

Objectives:
- Ensure `profiles.email` is NOT NULL and UNIQUE.
- Add missing academic columns on `profiles`: `branch_id uuid`, `year_id uuid`, `semester_id uuid`, `section text`, `roll_number text UNIQUE` (if not already unique), with FKs to lookup tables where appropriate.
- Backfill `profiles` from `students` by email.
- Backfill `profiles.role` from `admins` when inconsistent or missing.
- Create compatibility views `students_compat` and `admins_compat` (SECURITY INVOKER) to bridge existing code temporarily.
- Adjust RLS so behavior remains unchanged.

Planned SQL (sketch):
```sql
BEGIN;

-- 1) Constraints on profiles.email
ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_email ON profiles (lower(email));

-- 2) Add academic columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_id uuid   REFERENCES years(id) ON DELETE RESTRICT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES semesters(id) ON DELETE RESTRICT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roll_number text;
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_roll_number ON profiles (roll_number) WHERE roll_number IS NOT NULL;

-- 3) Backfill academic fields from students by email
UPDATE profiles p SET
  branch_id   = COALESCE(p.branch_id,   s.branch_id),
  year_id     = COALESCE(p.year_id,     s.year_id),
  semester_id = COALESCE(p.semester_id, s.semester_id),
  section     = COALESCE(p.section,     s.section),
  roll_number = COALESCE(p.roll_number, s.roll_number)
FROM students s
WHERE lower(p.email) = lower(s.email);

-- 4) Backfill roles from admins when needed
UPDATE profiles p SET role = a.role::text
FROM admins a
WHERE lower(p.email) = lower(a.email)
  AND (p.role IS NULL OR p.role <> a.role::text);

-- 5) Create compatibility views
DROP VIEW IF EXISTS students_compat CASCADE;
CREATE VIEW students_compat AS
SELECT 
  p.id,
  p.roll_number,
  p.name,
  p.email,
  p.branch_id,
  p.year_id,
  p.semester_id,
  p.section,
  p.created_at,
  p.updated_at
FROM profiles p
WHERE p.role IN ('student','representative');

DROP VIEW IF EXISTS admins_compat CASCADE;
CREATE VIEW admins_compat AS
SELECT 
  p.id,
  p.email,
  p.role,
  p.created_at
FROM profiles p
WHERE p.role IN ('admin','superadmin');

-- 6) RLS adjustments (example; refine to your policies)
ALTER VIEW students_compat SET (security_invoker = on);
ALTER VIEW admins_compat   SET (security_invoker = on);

COMMIT;

-- Rollback notes: DROP views; optionally drop columns; indexes are safe to keep.
```

RLS considerations:
- Keep existing table RLS unchanged for now. Views use SECURITY INVOKER to honor underlying table RLS. Verify that self-access and admin access still work via `profiles` role checks.

---

### D) Code updates (Stage A)

Tight diffs to stop depending on base tables while views exist:
- Replace `.from('students')` reads with `.from('students_compat')` temporarily, or switch directly to `profiles` with new academic columns where simple.
- Replace `.from('admins')` gating with `profiles.role` checks. Keep admin management endpoints but make them update `profiles.role` (and optionally upsert `admins` for transition).
- Specific targets:
  - `app/api/profile/route.ts`: read/write academic fields from `profiles` (no `students` join). For relations, join `branches/years/semesters` by `*_id` on `profiles`.
  - `app/(protected)/layout.tsx`: gate by existence of `profiles` row (and/or presence of academic fields), not `students`.
  - `app/api/resources/route.ts`: infer missing filters from `profiles` academic fields instead of `students`; relation `uploader` can use `profiles` or drop for now.
  - `app/api/admin/resources/*`: use `profiles.role` for gating; resolve `created_by` to `profiles.id`. Keep legacy FK by writing both if necessary.
  - `lib/admin-auth.ts` + `lib/auth-permissions.ts`: read roles exclusively from `profiles.role`; representatives logic unchanged.
  - `app/api/semester-promotion/route.ts`: update `profiles.semester_id`/`year_id` instead of `students`.

Note: Where foreign keys currently expect `students.id` or `admins.id`, continue writing those columns if tables remain. Otherwise, temporarily swap to the compatibility views or make those columns nullable while code migrates.

---

### E) Migration Stage B (post-code deploy)

- Option A (recommended): rename base tables to `students_legacy` and `admins_legacy`; keep compatibility views for one more release, then drop.
- Option B (after validation): drop `students`/`admins` and `admin_scopes` if fully replaced by `profiles` and code paths no longer reference them.
- Drop compatibility views once no references remain.
- Update or remove FKs (`resources.created_by`, etc.) to reference `profiles` if still needed.

Rollback:
- Keep backups (`profiles_backup`, `students_backup`, `admins_backup`) if performing destructive changes. To revert, restore backups, re-point code to legacy tables, and re-create views if needed.

---

### F) Validation

- `/api/users-count` equals `SELECT COUNT(*) FROM profiles`.
- Sign-in, role gating (admin/superadmin/representative), representative features continue to work.
- RLS: no unauthorized access; self-access preserved.
- Grep shows 0 remaining references to `.from('students')` or `.from('admins')` in app code (except compatibility views).

---

### Confirmations (received)

- Keep `profiles` as canonical; do not adopt unified `users` table now.
- Data in `students/admins` is not critical; prefer deleting after code updates rather than renaming.
- No need for backups/compat views if we can safely migrate and delete; proceed minimal.
- Start in `dev` environment.


