## Developer Dashboard Refactor: Supabase + Google Drive Admin CMS

This document describes a step-by-step implementation plan to refactor the developer dashboard into a simple but robust admin CMS with two admin roles, audit logs, immediate application of changes, and file handling across Google Drive (PDFs) and Supabase Storage (other files).

You can implement this in iterative slices. Each section provides concrete SQL, API contracts, and UI flows using existing `components/ui/*`.

### Goals and decisions
- Two admin roles: `admin`, `superadmin`.
- Immediate apply: all changes take effect immediately.
- Storage routing: PDFs → Google Drive; non-PDFs → Supabase Storage (`resources` bucket).
- Single Drive folder id for now (configurable in Settings; later can expand to per-category).
- Replace file on edit allowed; delete old file versions.
- Delete behavior: Try to hard-delete the underlying file; if that fails, soft-delete the DB row and record failure in audit logs.
- Manage these entities in the dashboard: resources, archive (same model as resources with `archived` flag), recent updates, exams, reminders.
- Year and branch are captured on all entities; subjects remain free text for now (taxonomy improvements can come later).
- Quick link open in the UI lists; keep lists minimal (no advanced filters/pagination needed initially).
- Keep current max upload size and whitelist.

---

## 1) Database schema (SQL)

Run these in Supabase SQL editor. Adjust names as needed. All tables default to RLS enabled; admin APIs use the service role server-side.

```sql
-- ENUM: admin role
create type admin_role as enum ('admin', 'superadmin');

-- ENUM: branch values
create type branch_type as enum ('CSE','AIML','DS','AI','ECE','EEE','MEC','CE');

-- admins table
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role admin_role not null default 'admin',
  created_at timestamptz not null default now()
);

-- settings (singleton)
create table if not exists settings (
  id boolean primary key default true check (id = true), -- singleton row
  drive_folder_id text,                 -- Google Drive folder id
  storage_bucket text not null default 'resources',
  pdf_to_drive boolean not null default true,
  non_pdf_to_storage boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Ensure a singleton row exists
insert into settings (id) values (true)
on conflict (id) do nothing;

-- audit logs
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_email text not null,
  actor_role admin_role not null,
  action text not null, -- e.g., create|update|delete|soft_delete|restore|settings_update|login
  entity text not null, -- e.g., resource|reminder|recent_update|exam|settings|admin
  entity_id text,       -- uuid or composite id as text
  success boolean not null default true,
  message text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- resources
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  subject text not null,
  unit int not null,
  name text not null,
  description text,
  date timestamptz not null default now(),
  type text,
  url text not null,
  is_pdf boolean not null default false,
  year smallint,        -- 1..4
  branch branch_type,   -- enum
  archived boolean not null default false,
  semester smallint,    -- optional for future
  regulation text,      -- optional for future
  deleted_at timestamptz
);

create index if not exists idx_resources_subject on resources (subject);
create index if not exists idx_resources_category on resources (category);
create index if not exists idx_resources_unit on resources (unit);
create index if not exists idx_resources_date on resources (date desc);
create index if not exists idx_resources_archived on resources (archived);

-- reminders
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date not null,
  description text,
  icon_type text,
  status text,
  year smallint,
  branch branch_type,
  deleted_at timestamptz
);
create index if not exists idx_reminders_due_date on reminders (due_date);

-- recent_updates
create table if not exists recent_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date,
  description text,
  year smallint,
  branch branch_type,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_recent_updates_created_at on recent_updates (created_at desc);

-- exams
create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  exam_date date not null,
  description text,
  year smallint,
  branch branch_type,
  deleted_at timestamptz
);
create index if not exists idx_exams_exam_date on exams (exam_date);

-- RLS: default deny (for safety). Admin APIs run with service role.
alter table admins enable row level security;
alter table settings enable row level security;
alter table audit_logs enable row level security;
alter table resources enable row level security;
alter table reminders enable row level security;
alter table recent_updates enable row level security;
alter table exams enable row level security;

-- Public read policies (optional: keep disabled if all reads go through server)
-- example: allow public select on resources that are not soft-deleted
-- create policy public_read_resources on resources for select using (deleted_at is null);
```

Foreign keys and referential integrity (recommended additions):

```sql
-- 1) Prefer referencing admins by id instead of email in audit logs
alter table audit_logs add column if not exists actor_id uuid;

-- Backfill actor_id from email (one-time migration)
update audit_logs al
set actor_id = a.id
from admins a
where lower(al.actor_email) = lower(a.email)
  and al.actor_id is null;

-- Enforce the FK; keep actor_email for display/debug, but rely on actor_id for integrity
alter table audit_logs
  add constraint if not exists fk_audit_logs_actor
  foreign key (actor_id) references admins(id) on delete restrict;

-- Optional: once confident, make actor_id NOT NULL and drop actor_email
-- alter table audit_logs alter column actor_id set not null;
-- alter table audit_logs drop column actor_email;

-- 2) Track ownership/creator on domain tables and enforce FK to admins
alter table resources add column if not exists created_by uuid;
alter table reminders add column if not exists created_by uuid;
alter table recent_updates add column if not exists created_by uuid;
alter table exams add column if not exists created_by uuid;

alter table resources
  add constraint if not exists fk_resources_created_by
  foreign key (created_by) references admins(id) on delete set null;

alter table reminders
  add constraint if not exists fk_reminders_created_by
  foreign key (created_by) references admins(id) on delete set null;

alter table recent_updates
  add constraint if not exists fk_recent_updates_created_by
  foreign key (created_by) references admins(id) on delete set null;

alter table exams
  add constraint if not exists fk_exams_created_by
  foreign key (created_by) references admins(id) on delete set null;

-- 3) Optional: replace enum with lookup table for branches for easier maintenance
--    This is an alternative to the branch_type enum; use ONE approach (enum or table).
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 2 and 8),
  name text not null check (char_length(name) between 2 and 64)
);

-- Seed common branches (id values auto-generated)
insert into branches (code, name) values
  ('CSE','Computer Science and Engineering'),
  ('AIML','Artificial Intelligence & ML'),
  ('DS','Data Science'),
  ('AI','Artificial Intelligence'),
  ('ECE','Electronics & Communication'),
  ('EEE','Electrical & Electronics'),
  ('MEC','Mechanical'),
  ('CE','Civil')
on conflict (code) do nothing;

-- If migrating from enum columns `branch branch_type` to lookup:
-- 1) Add nullable branch_id column referencing branches
alter table resources add column if not exists branch_id uuid references branches(id);
alter table reminders add column if not exists branch_id uuid references branches(id);
alter table recent_updates add column if not exists branch_id uuid references branches(id);
alter table exams add column if not exists branch_id uuid references branches(id);

-- 2) Backfill branch_id from existing enum/text branch column (if present)
-- update resources r set branch_id = b.id from branches b where r.branch::text = b.code and r.branch_id is null;
-- Repeat for reminders/recent_updates/exams as needed.

-- 3) Optionally drop the enum column after verifying backfill
-- alter table resources drop column branch;
-- alter table reminders drop column branch;
-- alter table recent_updates drop column branch;
-- alter table exams drop column branch;
```

Seed your first superadmin:

```sql
insert into admins (email, role)
values ('your-email@example.com', 'superadmin')
on conflict (email) do update set role = excluded.role;
```

---

## 2) Environment variables

Keep secrets in env; keep non-secret runtime-config in `settings` table.

- NEXTAUTH_SECRET
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GOOGLE_APPLICATION_CREDENTIALS_JSON
- Optional bootstrap: GOOGLE_DRIVE_FOLDER_ID (used only as fallback if `settings.drive_folder_id` is null)

---

## 3) Server utilities

Create small server helpers used by all admin APIs.

```ts
// lib/admin-auth.ts (server-only)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'

export type AdminContext = { email: string; role: 'admin'|'superadmin' }

export async function requireAdmin(minRole: 'admin'|'superadmin' = 'admin'): Promise<AdminContext> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Error('Unauthorized')

  const email = session.user.email.toLowerCase()
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase.from('admins').select('email, role').eq('email', email).maybeSingle()
  if (error || !data) throw new Error('Forbidden')
  if (minRole === 'superadmin' && data.role !== 'superadmin') throw new Error('Forbidden')
  return { email: data.email, role: data.role as AdminContext['role'] }
}

export async function getSettings() {
  const supabase = createSupabaseAdmin()
  const { data } = await supabase.from('settings').select('*').single()
  return data
}
```

Audit logger:

```ts
// lib/audit.ts (server-only)
import { createSupabaseAdmin } from '@/lib/supabase'

export async function logAudit(entry: {
  actor_email: string
  actor_role: 'admin'|'superadmin'
  action: string
  entity: string
  entity_id?: string
  success?: boolean
  message?: string
  before_data?: unknown
  after_data?: unknown
}) {
  const supabase = createSupabaseAdmin()
  await supabase.from('audit_logs').insert({
    ...entry,
    success: entry.success ?? true,
  })
}
```

File helpers (Drive + Storage): reuse current upload logic; add delete helpers.

```ts
// lib/files.ts (server-only)
import { google } from 'googleapis'
import { createSupabaseAdmin } from '@/lib/supabase'

export async function deleteDriveFile(fileId: string) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}')
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] })
  const drive = google.drive({ version: 'v3', auth })
  await drive.files.delete({ fileId })
}

export async function deleteStorageObject(bucket: string, path: string) {
  const supabase = createSupabaseAdmin()
  await supabase.storage.from(bucket).remove([path])
}

export function tryParseDriveIdFromUrl(url: string): string | null {
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  return m?.[1] || null
}

export function tryParseStoragePathFromUrl(url: string): { bucket: string; path: string } | null {
  // For public URLs like https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const m = url.match(/\/object\/public\/([^/]+)\/(.+)$/)
  if (!m) return null
  return { bucket: m[1], path: m[2] }
}
```

---

## 4) Admin API routes

All under `/api/admin/*`, server-only, service-role client. Each route:
- Verifies admin via `requireAdmin(minRole)`.
- Performs requested action.
- Logs audit entry (success or failure) with `before_data` and `after_data`.

### 4.1 Resources

Routes:
- GET `/api/admin/resources` → list minimal fields; supports filters and pagination
- POST `/api/admin/resources` → create with optional file
- PATCH `/api/admin/resources/:id` → metadata edit; optional file replacement (delete old file first, then upload new)
- DELETE `/api/admin/resources/:id` → hard-delete file then row; on failure soft-delete row (`deleted_at`) and return warning

Payloads (TypeScript types):

```ts
type Branch = 'CSE'|'AIML'|'DS'|'AI'|'ECE'|'EEE'|'MEC'|'CE'

type ResourceCreate = {
  category: string
  subject: string
  unit: number
  name: string
  description?: string
  type?: string
  year?: 1|2|3|4
  branch?: Branch
  archived?: boolean
  // file: multipart form-data field 'file'
}

type ResourceUpdate = Partial<ResourceCreate>
```

Validation rules (server-enforced; use Zod/Joi/DTOs):

- Required fields on create: `category` (string, 1..50), `subject` (string, 1..80), `unit` (integer, 1..20), `name` (string, 1..120)
- Optional fields:
  - `description` (string, 0..1000)
  - `type` (string, 1..50)
  - `year` (enum 1|2|3|4)
  - `branch` (enum Branch)
  - `archived` (boolean)
- File (multipart, field `file`):
  - Max size: 25 MB
  - Allowed MIME: application/pdf, image/png, image/jpeg, image/webp
  - Allowed extensions: pdf, png, jpg, jpeg, webp
  - MIME/extension are verified by signature sniffing; client-provided MIME may be overridden
- On update: payload may include any subset of fields above; at least one updatable field must be present

Validation error response shape (all endpoints):

```json
{
  "error": "ValidationError",
  "message": "Invalid request",
  "fieldErrors": {
    "field": [{ "code": "too_small|too_big|invalid_type|invalid_enum|required", "message": "..." }]
  }
}
```

GET filters and pagination:

- Query params:
  - `page` (integer, default 1, min 1)
  - `limit` (integer, default 20, max 100)
  - `sort` (string, one of: `date`, `name`, `created_at`; default `date`)
  - `order` (string, `asc`|`desc`, default `desc`)
  - Filters: `archived` (boolean), `year` (1..4), `branch` (Branch code), `subject` (string contains, case-insensitive), `category` (string exact), `unit` (integer)

Example response:

```json
{
  "data": [
    { "id": "...", "name": "Relational Model Notes", "category": "notes", "subject": "dbms", "unit": 1, "type": "Notes", "year": 2, "branch": "CSE", "date": "2024-05-01T10:00:00Z", "is_pdf": true, "url": "..." }
  ],
  "meta": { "page": 1, "limit": 20, "count": 1, "total": 57, "totalPages": 3, "sort": "date", "order": "desc", "filters": { "branch": "CSE" } }
}
```

File lifecycle:
- Create/Update: if file is provided
  - If PDF → upload to Drive folder from `settings.drive_folder_id`, set public permissions, set `is_pdf=true`, store webViewLink URL
  - Else → upload to Supabase Storage (`settings.storage_bucket`), set `is_pdf=false`, store public URL
- Update with replacement: parse previous URL; delete previous Drive file or storage object first; then upload new
- Delete: attempt to delete underlying blob (Drive or Storage) based on URL; if deletion fails, set `deleted_at` and log failure

### 4.2 Reminders

Routes:
- GET `/api/admin/reminders` (supports pagination and optional `status` filter)
- POST `/api/admin/reminders`
- PATCH `/api/admin/reminders/:id`
- DELETE `/api/admin/reminders/:id` (hard delete row; no file)

Fields: `title, due_date, description?, icon_type?, status?, year?, branch?`

Validation:
- `title` (string, 1..120) required on create
- `due_date` (date string YYYY-MM-DD) required on create
- Optional: `description` (0..500), `icon_type` (string 1..32; letters, numbers, dash/underscore), `status` (string 1..24), `year` (1..4), `branch` (Branch)

GET pagination:
- `page` (default 1), `limit` (default 20, max 100), `sort` (`due_date`|`title`|`created_at`, default `due_date`), `order` (`asc`|`desc`, default `asc`), `status` (optional exact)

Response shape:
```json
{ "data": [ { "id": "...", "title": "...", "due_date": "2025-01-20", "status": "..." } ], "meta": { "page": 1, "limit": 20, "count": 20, "total": 145, "totalPages": 8 } }
```

### 4.3 Recent Updates

Routes:
- GET `/api/admin/recent-updates` (supports pagination)
- POST `/api/admin/recent-updates`
- PATCH `/api/admin/recent-updates/:id`
- DELETE `/api/admin/recent-updates/:id`

Fields: `title, date?, description?, year?, branch?` (plus `created_at` auto)

Validation:
- `title` (string, 1..120) required on create
- `date` optional (YYYY-MM-DD); if omitted, server sets to today or uses `created_at`
- Optional: `description` (0..1000), `year` (1..4), `branch` (Branch)

GET pagination:
- `page` (default 1), `limit` (default 20, max 100), `sort` (`created_at`|`date`|`title`, default `created_at`), `order` (`asc`|`desc`, default `desc`)

### 4.4 Exams

Routes:
- GET `/api/admin/exams` (supports pagination)
- POST `/api/admin/exams`
- PATCH `/api/admin/exams/:id`
- DELETE `/api/admin/exams/:id`

Fields: `subject, exam_date, description?, year?, branch?`

Validation:
- `subject` (string, 1..120) and `exam_date` (YYYY-MM-DD) required on create
- Optional: `description` (0..500), `year` (1..4), `branch` (Branch)

GET pagination:
- `page` (default 1), `limit` (default 20, max 100), `sort` (`exam_date`|`subject`|`created_at`, default `exam_date`), `order` (`asc`|`desc`, default `asc`)

### 4.5 Settings (superadmin only)

Routes:
- GET `/api/admin/settings`
- PUT `/api/admin/settings` (superadmin) → update `drive_folder_id`, `storage_bucket`, `pdf_to_drive`, `non_pdf_to_storage`

Validation:
- `drive_folder_id` (string 10..128) optional
- `storage_bucket` (string 3..63, lowercase, `^[a-z0-9-]+$`) optional
- `pdf_to_drive` (boolean), `non_pdf_to_storage` (boolean)
Response on validation error follows the common shape above.

### 4.6 Admins (superadmin only)

Routes:
- GET `/api/admin/admins`
- POST `/api/admin/admins` → add admin with role
- PATCH `/api/admin/admins/:email` → change role
- DELETE `/api/admin/admins/:email`

Validation:
- POST: `email` (valid email, lowercase, <= 254 chars) and `role` (enum 'admin'|'superadmin') required
- PATCH: `role` (enum 'admin'|'superadmin') required

GET pagination:
- `page` (default 1), `limit` (default 20, max 100), `sort` (`created_at`|`email`|`role`, default `created_at`), `order` (`asc`|`desc`, default `desc`)

Rate limiting (recommended):
- Enforce server-side rate limits for admin routes: e.g., 60 requests/minute per IP and/or per admin user; burst allowance 10.
- Implement at the edge/middleware layer (e.g., Next.js Middleware + a provider like Upstash Ratelimit) or via your API gateway/CDN.
- Return HTTP 429 with `{ error: 'RateLimited', retryAfterSeconds: <n> }` when exceeded.

---

## 5) Refactor existing public APIs

Keep the existing public-facing routes; extend schemas only:

- `/api/resources` (already uses Supabase): remains the same, now benefits from `year`/`branch` columns available for future filters.
- `/api/recent-updates`: unchanged behavior; ensure it ignores `deleted_at`.
- `/api/reminders`: unchanged behavior; ensure it ignores `deleted_at`.
- `/api/prime-section-data`: now exams include `year`/`branch`. Keep logic, optionally filter by nearest exams, then query resources by `subject in (...)` as today.

Note: Archive view uses `resources.archived = true` with same model as resources.

---

## 6) Dashboard UI (pages and components)

Use `components/ui/*` (cards, inputs, buttons, table/simple list, dialog/sheet). Keep the aesthetic consistent with current site.

Navigation items within `/dev-dashboard`:
- Resources
- Archive
- Reminders
- Recent Updates
- Exams
- Settings (superadmin)
- Admins (superadmin)

General UI patterns:
- Each section shows a simple list of items with minimal fields and a right-side action bar: [Open/View], [Edit], [Delete].
- Quick link open: in resources list, include a button to open the resource URL in a new tab.
- Forms: use a modal or drawer with simple labeled inputs. Resource form has a file input (optional on edit).
- Year/branch selectors: small `<Select>` for `1..4` and branch enum; otherwise keep inputs free-text (`subject`, `category`, `type`).

Section specifics:

1) Resources
- List columns: Name, Category, Subject, Unit, Type, Year, Branch, Date, isPDF, [Open], [Edit], [Delete].
- Create/Edit form fields: `name, description, category, subject, unit (int), type, year (1..4), branch (enum), file (optional on edit), archived (checkbox)`.
- On edit with file: show warning that replacing file will delete the old file.
- Delete: confirm dialog; show message if soft-deleted due to file deletion failure.

2) Archive
- Same UI as Resources but pre-filtered to `archived = true` and the create/edit form sets `archived = true` by default.

3) Reminders
- List: Title, Due Date, Status, Year, Branch, [Edit], [Delete].
- Form: `title, due_date (date), description, icon_type, status, year, branch`.

4) Recent Updates
- List: Title, Date, Year, Branch, Created At, [Edit], [Delete].
- Form: `title, date (optional), description, year, branch`.

5) Exams
- List: Subject, Exam Date, Year, Branch, [Edit], [Delete].
- Form: `subject, exam_date, description, year, branch`.

6) Settings (superadmin)
- Panel with cards for:
  - Google Drive: `drive_folder_id` (text input)
  - Storage: `storage_bucket` (text), toggles: `pdf_to_drive` and `non_pdf_to_storage` (read-only guidance if you prefer fixed policy)
- Save button → PUT `/api/admin/settings` → toast notification.

7) Admins (superadmin)
- List: Email, Role, Created At, [Promote/Demote], [Remove]
- Form: Add admin by email and role.

Toasts and validation:
- Use existing `use-toast` or `sonner` components for success/error.
- Use minimal client validation; do server validation thoroughly.

---

## 7) File lifecycle and error handling

Create:
- Route parses multipart form.
- Decide destination by MIME/ext rules already present.
- Upload and get public URL; insert row; audit log.

Update with replacement:
- Fetch previous row; parse URL.
- Try deleting old file (Drive or Storage). If deletion fails, abort update and audit failure.
- Upload new file and update row; audit success.

Delete:
- Fetch row; attempt to delete file based on URL.
- If file deletion succeeds → delete row; audit success.
- If file deletion fails → set `deleted_at = now()`; audit with `success=false` and message.

Drive nuances:
- Use `files.permissions.create` to make file public.
- Store `webViewLink`. Keep a helper to extract `fileId` for deletion.

Storage nuances:
- Use `getPublicUrl` to store a stable URL.
- Keep a helper to parse bucket/path for deletion.

---

## 8) Security model

- NextAuth Google sign-in only.
- Server-side authorization in all admin APIs via `requireAdmin(minRole)` using Supabase `admins` table.
- RLS: keep strict (no public writes). Public reads can continue via server routes.
- Service role key used server-side only.
- Audit every admin action with before/after snapshots (mask secrets as needed).

---

## 9) Step-by-step implementation plan

1) Schema and bootstrap
- Run the SQL in section 1.
- Seed your email as superadmin.

2) Server helpers
- Add `lib/admin-auth.ts`, `lib/audit.ts`, `lib/files.ts` per section 3.

3) Admin APIs
- Implement `/api/admin/settings` (GET/PUT, superadmin).
- Implement `/api/admin/admins` (GET/POST/PATCH/DELETE, superadmin).
- Implement `/api/admin/resources` (GET/POST) and `/api/admin/resources/[id]` (PATCH/DELETE) with file lifecycle.
- Implement `/api/admin/reminders`, `/api/admin/recent-updates`, `/api/admin/exams` similarly.
- Ensure each route logs audit entries on success and failure.

4) Refactor existing routes minimally
- Ensure public routes filter out rows with `deleted_at is not null`.
- No UI changes required to public pages right now.

5) Dev dashboard UI
- Create a simple tabbed layout or sidebar within `/dev-dashboard` to switch sections.
- Build lists with minimal columns and action buttons.
- Build modal/drawer forms for create/edit.
- Wire to the admin APIs.

6) Settings panel
- Build the settings card UI for Drive folder id and storage config, superadmin only.
- On save, call PUT `/api/admin/settings`, toast result.

7) Admin management panel
- Superadmin-only list and edit of admins.

8) Testing
- Test uploads: PDF → Drive; image → Storage.
- Test replace file: ensure old file deleted.
- Test delete: ensure blob deletion; simulate failure and verify soft-delete path.
- Verify audit logs are written for all actions.

9) Operational
- Enable daily export of `audit_logs` if needed (optional).
- Consider rate limits on admin routes (optional).

---

## 10) API examples

Create resource (multipart):

```
POST /api/admin/resources
Content-Type: multipart/form-data
fields:
  category: notes
  subject: dbms
  unit: 1
  name: "Relational Model Notes"
  description: "Chapter 1"
  type: "Notes"
  year: 2
  branch: CSE
  file: <pdf or image>
```

Update resource metadata:

```
PATCH /api/admin/resources/:id
json:
  { name: "Relational Model Notes (v2)", year: 3 }
```

Replace resource file:

```
PATCH /api/admin/resources/:id
Content-Type: multipart/form-data
fields:
  file: <new file>
```

Delete resource:

```
DELETE /api/admin/resources/:id
```

---

## 11) Notes and future work

- Subjects will remain free-text for now; later you can introduce a taxonomy tables set and tighten validation.
- Settings can be extended to support multiple Drive folders routing by category/semester.
- Consider adding CSV import/export for bulk operations later.
- Add pagination if lists grow; for now, keep lists compact.


