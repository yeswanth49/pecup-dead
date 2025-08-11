## Profile Onboarding: Plan and Implementation Guide

### Goal
Collect user profile data on first sign-in and store it in Supabase. Block access to protected pages until onboarding is complete. After onboarding, redirect users to `/home`. Provide a `/profile` page for editing later.

### Summary of decisions
- **Onboarding page**: `/onboarding` (dedicated page)
- **Post-onboarding redirect**: `/home`
- **Profile edit page**: `/profile`
- **Table**: `profiles`
- **Fields**: `id (uuid)`, `email (text, unique, lowercase)`, `name (text)`, `year (smallint 1–4)`, `branch (branch_type)`, `roll_number (text, unique)`, `created_at`, `updated_at`
- **Branch enum**: reuse `branch_type` (`'CSE','AIML','DS','AI','ECE','EEE','MEC','CE'`)
- **Email source**: NextAuth Google session (no user input)
- **Name prefill**: from Google display name (editable)
- **Gating**: all signed-in users must complete onboarding; protected pages are blocked until a `profiles` row exists
- **API**: `/api/profile` — `GET` (fetch current profile), `POST` (create/update current profile)

---

## 1) Database schema (Supabase SQL)
Run in Supabase SQL editor (or add to `scripts/create-tables.sql` in a migration step).

```sql
-- enum already exists per codebase docs; include only if missing
DO $$ BEGIN
  CREATE TYPE branch_type AS ENUM ('CSE','AIML','DS','AI','ECE','EEE','MEC','CE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,              -- stored lowercase
  name text NOT NULL,
  year smallint NOT NULL CHECK (year BETWEEN 1 AND 4),
  branch branch_type NOT NULL,
  roll_number text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- triggers for updated_at (optional)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS enable (optional; API will use service role on server)
DO $$ BEGIN EXECUTE 'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;
```

Notes:
- We will treat “profile exists for email” as the indicator that onboarding is complete; no extra boolean is needed.
- `email` should be saved in lowercase to ensure uniqueness and easy lookups.

---

## 2) API contract (`/api/profile`)
Server-side route that uses the Supabase service role key via `createSupabaseAdmin()`.

### GET /api/profile
- Purpose: Fetch the current user’s profile by session email.
- Auth: Requires NextAuth session; uses `session.user.email` (lowercased).
- Responses:
  - 200: `{ profile: Profile | null }` — `null` means onboarding required
  - 401: if not authenticated
  - 500: on server/db error

### POST /api/profile
- Purpose: Create or update the current user’s profile (upsert by email).
- Auth: Requires NextAuth session; `email` always taken from session.
- Request body JSON:
  ```json
  {
    "name": "string",
    "year": 1,
    "branch": "CSE",
    "roll_number": "23A31A05B5"
  }
  ```
- Validation:
  - `name`: non-empty string
  - `year`: integer 1–4
  - `branch`: one of `branch_type`
  - `roll_number`: non-empty string (format TBD; globally unique)
- Responses:
  - 200: `{ profile: Profile }` (created or updated)
  - 400: validation error or uniqueness conflict explained
  - 401: if not authenticated
  - 500: on server/db error

---

## 3) Gating and routing
Goal: Prevent access to protected pages until a profile exists for the signed-in email.

Recommended approach: a server-side protected layout (e.g., `app/(protected)/layout.tsx`) that:
- Retrieves the NextAuth session via `getServerSession(authOptions)`
- If no session: redirect to `/login`
- If session exists: query Supabase (service client) for `profiles` by email
- If no profile: redirect to `/onboarding`
- If profile exists: render children

Apply this layout to all protected routes (e.g., `app/(protected)/home/page.tsx`, other app pages). Exclude `/login`, `/onboarding`, and public pages from this guard.

---

## 4) UI flows

### `/onboarding` page
- Client form with fields: `name`, `year` (1–4 select), `branch` (select from enum), `roll_number` (text)
- Prefill `name` from `session.user.name` if available
- Submit to `POST /api/profile`
- On success, redirect to `/home`
- Show errors inline (validation / uniqueness)

### `/profile` page
- Fetch current profile via `GET /api/profile`
- Display editable fields: `name`, `year`, `branch`, `roll_number`
- Display `email` as read-only (from session or profile)
- Save changes via `POST /api/profile`

### `/home` page
- Standard landing page for authenticated, onboarded users
- No special changes beyond relying on the protected layout

---

## 5) Step-by-step implementation

1. Schema
   - Create the `profiles` table and supporting trigger using the SQL above.

2. API route
   - Add `app/api/profile/route.ts` with two handlers:
     - `GET`: fetch by session email (lowercased); return `null` if not found
     - `POST`: validate body; upsert by email (insert on missing, otherwise update); handle unique conflicts for `roll_number`
   - Use `getServerSession(authOptions)` and `createSupabaseAdmin()` inside the route.

3. Protected layout
   - Create a segment for protected routes, e.g., `app/(protected)/layout.tsx`
   - Check session and profile existence on the server; redirect accordingly
   - Move protected pages (e.g., `home`) under this segment (`app/(protected)/home/page.tsx`)

4. Onboarding page
   - Create `app/onboarding/page.tsx`
   - Build the form with existing `components/ui/*` primitives
   - Prefill `name` from `useSession()` when available
   - On submit: `fetch('/api/profile', { method: 'POST', body: JSON.stringify(...) })`
   - On success: `router.replace('/home')`

5. Profile page
   - Create `app/profile/page.tsx`
   - Load current profile on mount; handle loading/error states
   - Allow edits and submit via `POST /api/profile`

6. Login flow
   - Ensure post-login navigation lands users in the protected area
   - If they lack a profile, the protected layout will push them to `/onboarding`

7. Error handling and UX
   - Surface validation errors from API in the forms
   - Handle `409`-like conflicts for `roll_number` uniqueness as `400` with clear messages

8. Telemetry and audit (optional)
   - Optionally record an audit log row (if desired) on profile create/update

---

## 6) Validation details
- `name`: non-empty, trimmed length <= 150
- `year`: integer in [1, 4]
- `branch`: must match `branch_type`
- `roll_number`: non-empty; future regex can be added later
- Normalize `email` to lowercase before DB operations

---

## 7) Testing checklist
- Anonymous user visiting protected route → redirected to `/login`
- Authenticated user without profile visiting protected route → redirected to `/onboarding`
- Submitting valid onboarding form → profile created; redirected to `/home`
- Subsequent visits → allowed into protected routes
- `/profile` shows current data and updates successfully
- Uniqueness:
  - Creating second profile with same `email` is prevented (upsert updates instead)
  - Setting `roll_number` that already exists fails with clear error

---

## 8) Deployment notes
- Ensure environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`
- Run the schema SQL in Supabase before deploying the routes/pages.

---

## 9) Future enhancements
- Add `roll_number` format validation (regex) once finalized
- Allow optional fields (e.g., phone, avatar)
- Add `completed_at` timestamp if detailed analytics are required
- Consider client-Supabase with RLS if moving away from service-role API pattern


