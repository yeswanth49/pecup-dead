# Database Schema Red Flags & Fix Plan

## Executive Summary

Your current schema suffers from critical design inconsistencies that will cause data drift, sync issues, and maintenance nightmares. This document analyzes 6 major red flags and provides concrete fixes based on your preferences for:

- Foreign key relationships over enums (except tiny immutable lists)
- Unified identity management with independent UUID PKs
- Resource table normalization via split design
- Production stability (enum values preserved for external clients)
- Separate migration files under `/migrations/`

**Risk Assessment:** HIGH - Multiple data integrity and maintenance issues already present. Migration required to prevent production outages.

---

## 🚩 Red Flag 1: Inconsistent Branch/Year/Semester Representation

### Current Problem
Your schema uses **dual representation** causing inevitable drift:

**ENUM-based tables:**
```sql
-- In profiles, resources, reminders, exams, recent_updates
branch branch_type NOT NULL,  -- ENUM: 'CSE','AIML','DS','AI','ECE','EEE','MEC','CE'
year SMALLINT NOT NULL,       -- Raw year: 1,2,3,4
semester SMALLINT             -- Raw semester: 1,2
```

**Foreign Key-based tables:**
```sql
-- In students, subject_offerings
branch_id uuid REFERENCES branches(id)
year_id uuid REFERENCES years(id)
semester_id uuid REFERENCES semesters(id)
```

### Why This Burns You
1. **Data Drift**: `profiles.year = 1` ≠ `students.year_id` pointing to 2024 batch
2. **Query Complexity**: Need different JOIN patterns for different tables
3. **Maintenance Burden**: Year mappings hardcoded in application code
4. **External Client Risk**: Breaking enum changes affect production API consumers

### Evidence from Your Code
```javascript
// From academic_config.js - hardcoded year mapping
"year_mappings": {
  "2024": 1, "2023": 2, "2022": 3, "2021": 4
}
```
This mapping already "stale" as noted in your code review.

### Solution: Canonical Foreign Key Model
**Decision:** Use FK relationships exclusively for branch/year/semester. Keep enum values stable for external clients.

**New Structure:**
```sql
-- Keep lookup tables (already partially implemented)
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,  -- 'CSE', 'AIML', etc.
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enhanced years with configurable semester support
CREATE TABLE years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_year integer NOT NULL UNIQUE,
  display_name text NOT NULL,
  total_semesters integer NOT NULL DEFAULT 8,  -- Configurable per year
  created_at timestamptz DEFAULT now()
);

-- Semesters now support variable counts per year
CREATE TABLE semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES years(id),
  semester_number integer NOT NULL,  -- 1,2,3,...8 (not limited to 1-2)
  display_name text NOT NULL,        -- 'Semester 1', 'Semester 2', etc.
  start_date date,
  end_date date,
  UNIQUE (year_id, semester_number)
);
```

**Migration Strategy:**
1. Standardize all tables on FK relationships
2. Keep enum values frozen for API compatibility
3. Add enum→FK mapping functions for data migration

---

## 🚩 Red Flag 2: Profiles vs Students vs Admins Duplication

### Current Problem
You have **three separate identity tables** with overlapping data:

```sql
-- Profiles table (user onboarding)
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  name text,
  year smallint,      -- Raw value
  branch branch_type, -- ENUM
  role user_role,     -- 'student','admin','superadmin'
  -- ... other fields
);

-- Students table (academic records)
CREATE TABLE students (
  id uuid PRIMARY KEY,
  roll_number text UNIQUE,
  name text,
  email text UNIQUE,
  branch_id uuid REFERENCES branches(id),
  year_id uuid REFERENCES years(id),
  -- ... FK relationships
);

-- Admins table (system admins)
CREATE TABLE admins (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  role admin_role,  -- 'admin','superadmin'
  -- ... minimal fields
);
```

### Why This Burns You
1. **Identity Sync Issues**: Email/name changes in one table don't reflect in others
2. **Source of Truth Confusion**: Which table is authoritative for a given user?
3. **Query Complexity**: Need UNION queries to find "all users"
4. **Admin Identity Fragmentation**: Admins exist separately from user ecosystem

### Evidence from Your Schema
- `profiles` has role field but separate `students` table exists
- `admins` table duplicates email/name from potential `profiles` entries
- No clear foreign key relationships between these tables

### Solution: Unified Users Table
**Decision:** Create canonical `users` table with independent UUID PK, store `auth_user_id` as FK field.

**New Structure:**
```sql
-- Canonical users table (single source of truth)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,  -- FK to auth.users.id (future-proofs)
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Soft delete for audit compliance
  deleted_at timestamptz,
  UNIQUE (auth_user_id),
  UNIQUE (email)
);

-- Student academic profile (extends users)
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roll_number text UNIQUE,
  branch_id uuid REFERENCES branches(id),
  year_id uuid REFERENCES years(id),
  semester_id uuid REFERENCES semesters(id),
  section text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Admin extensions (if needed beyond basic user role)
CREATE TABLE admin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_scope text,  -- JSON for branch/year restrictions
  created_at timestamptz DEFAULT now()
);
```

**Migration Strategy:**
1. **Data Consolidation Priority:** profiles → students → admins
2. **Conflict Resolution:** Product stakeholders own merge decisions
3. **Deterministic Rules:** Prefer `profiles` data over `students` for conflicts
4. **Admin Migration:** Convert `admins` entries to `users` with admin role

---

## 🚩 Red Flag 3: Years & Semesters Fragile Modeling

### Current Problem
Your semester modeling is **boxed into 1-2 per year**:

```sql
-- Current semesters table
CREATE TABLE semesters (
  semester_number integer CHECK (semester_number IN (1, 2)),  -- LIMITED!
  year_id uuid REFERENCES years(id)
);

-- Current year modeling mixes concepts
CREATE TABLE years (
  batch_year integer,     -- 2024, 2023, etc.
  display_name text       -- "2024-25 Batch"
);
```

### Why This Burns You
1. **4-Year Limit Assumption**: B.Tech programs need 8 semesters (2 per year × 4 years)
2. **M.Tech/PhD Support**: Future programs may have different semester counts
3. **Calendar Drift**: No start/end dates for semester boundaries
4. **Hardcoded Logic**: Application code assumes 1-2 semester range

### Evidence from Your Schema
- `subject_offerings` and other tables reference semesters
- Current implementation assumes exactly 2 semesters per year
- No support for semester-specific start/end dates

### Solution: Configurable Semester Model
**Decision:** Support configurable semester counts per academic program.

**New Structure:**
```sql
-- Enhanced years table
CREATE TABLE years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_year integer NOT NULL UNIQUE,
  display_name text NOT NULL,
  program_type text NOT NULL DEFAULT 'btech',  -- 'btech', 'mtech', 'phd'
  total_semesters integer NOT NULL DEFAULT 8,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Flexible semesters table
CREATE TABLE semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES years(id),
  semester_number integer NOT NULL,  -- 1,2,3,...8 (no hardcoded limit)
  display_name text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (year_id, semester_number)
);

-- Academic calendar for current context
CREATE TABLE academic_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_year_id uuid REFERENCES years(id),
  current_semester_id uuid REFERENCES semesters(id),
  singleton boolean DEFAULT true UNIQUE,  -- Only one active calendar
  updated_at timestamptz DEFAULT now()
);
```

---

## 🚩 Red Flag 4: Audit Logs Actor Mismatch

### Current Problem
Audit logs only reference **admins**, missing student actions:

```sql
-- Current audit_logs structure
CREATE TABLE audit_logs (
  actor_email text NOT NULL,
  actor_role admin_role NOT NULL,  -- Only admin roles!
  action text,
  -- ... other fields
  actor_id uuid REFERENCES admins(id)  -- Only to admins table!
);
```

### Why This Burns You
1. **Incomplete Audit Trail**: Student resource uploads not logged
2. **Actor Identity Fragmentation**: No unified actor reference
3. **Query Complexity**: Different actor resolution logic needed
4. **Security Gaps**: Student actions not tracked for compliance

### Solution: Unified Actor Reference
**Decision:** Single FK to canonical users table, no polymorphism needed.

**New Structure:**
```sql
-- Unified audit logs
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES users(id),  -- Single FK to users
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  success boolean DEFAULT true,
  message text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

**Migration Strategy:**
1. **Actor Resolution:** Map existing `actor_email` to `users.email`
2. **Role Preservation:** Store role at time of action in JSON metadata
3. **Backwards Compatibility:** Keep `actor_email` column during transition

---

## 🚩 Red Flag 5: Settings Singleton Design Smell

### Current Problem
Hacky singleton implementation:

```sql
-- Current settings table
CREATE TABLE settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),  -- HACKY!
  drive_folder_id text,
  storage_bucket text,
  -- ... other fields
);
```

### Why This Burns You
1. **Poor Data Integrity**: No real constraints on singleton nature
2. **Query Complexity**: Need special handling for "get single row"
3. **Migration Issues**: Can't easily add multiple setting types
4. **Performance**: No proper indexing strategy

### Solution: Proper Singleton Pattern
**Decision:** Use LIMIT 1 with proper constraints and indexing.

**New Structure:**
```sql
-- Proper settings table
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Singleton constraint (only one row allowed)
  singleton boolean DEFAULT true NOT NULL CHECK (singleton = true),
  UNIQUE (singleton)
);

-- Or even simpler key-value approach
CREATE TABLE app_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);
```

---

## 🚩 Red Flag 6: Resource Table Overloaded (20+ Fields Spaghetti)

### Current Problem
The `resources` table is a **monstrosity with 20+ fields** mixing everything:

```sql
-- Current resources table (overloaded!)
CREATE TABLE resources (
  id uuid PRIMARY KEY,
  category text,
  subject text,
  unit integer,
  name text,           -- Title
  description text,
  date timestamp,      -- Upload date
  type text,           -- File type
  url text,            -- File URL
  is_pdf boolean,
  created_at timestamp,
  updated_at timestamp,
  year smallint,       -- Raw year
  branch branch_type,  -- ENUM
  semester smallint,   -- Raw semester
  archived boolean,
  regulation text,
  deleted_at timestamptz,
  created_by uuid,     -- FK to admins only!
  -- ... even more fields
);
```

### Why This Burns You
1. **Normalization Violation**: Mixing metadata, files, and lifecycle in one table
2. **Query Performance**: Wide table scans for simple lookups
3. **Update Anomalies**: Changing file URL affects entire resource record
4. **Extension Difficulty**: Hard to add file versioning or multiple formats

### Evidence from Your Schema
- 20+ fields in single table (counted from your create-tables.sql)
- Mixed concerns: metadata + file storage + academic context + lifecycle
- `created_by` only references admins (missing student uploads)

### Solution: Split Table Design
**Decision:** Split into `resources` + `resource_files` + `resource_metadata` tables.

**New Structure:**
```sql
-- Core resource entity
CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  subject text NOT NULL,
  unit integer NOT NULL,
  regulation text,
  branch_id uuid REFERENCES branches(id),
  year_id uuid REFERENCES years(id),
  semester_id uuid REFERENCES semesters(id),
  uploader_id uuid NOT NULL REFERENCES users(id),  -- Now references users!
  uploaded_at timestamptz DEFAULT now(),
  deleted_at timestamptz,  -- Soft delete
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- File storage (supports multiple files per resource)
CREATE TABLE resource_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  file_type text NOT NULL,  -- 'pdf', 'image', 'document'
  file_name text NOT NULL,
  drive_link text,          -- Google Drive link
  storage_url text,         -- Supabase Storage URL
  file_size_bytes bigint,
  is_primary boolean DEFAULT false,  -- Main file vs. attachments
  created_at timestamptz DEFAULT now()
);

-- Resource metadata (extensible key-value)
CREATE TABLE resource_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  meta_key text NOT NULL,
  meta_value jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (resource_id, meta_key)
);

-- Indexes for performance
CREATE INDEX idx_resources_uploader ON resources(uploader_id);
CREATE INDEX idx_resources_category ON resources(category);
CREATE INDEX idx_resources_subject ON resources(subject);
CREATE INDEX idx_resources_branch_year ON resources(branch_id, year_id);
CREATE INDEX idx_resource_files_resource ON resource_files(resource_id);
```

**Migration Strategy:**
1. **Data Preservation:** Keep all existing fields during transition
2. **Phased Migration:** Migrate to new structure while maintaining old table
3. **File Consolidation:** Handle cases where resources have both drive_link and url

---

## Concrete Migration Implementation

### Migration File Structure
All migrations will be created under `/migrations/` directory:

```
/migrations/
├── 001_create_unified_users.sql
├── 002_enhance_branches_years_semesters.sql
├── 003_split_resources_tables.sql
├── 004_migrate_audit_logs.sql
├── 005_fix_settings_singleton.sql
├── 006_data_consolidation.sql
├── 007_update_rls_policies.sql
└── README.md
```

### Phase 1: Unified Identity (`001_create_unified_users.sql`)
```sql
-- Create canonical users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (auth_user_id),
  UNIQUE (email)
);

-- Migrate data with conflict resolution
INSERT INTO users (auth_user_id, email, name, role, created_at, updated_at)
SELECT
  gen_random_uuid() as auth_user_id,  -- Generate temp auth IDs
  email, name, role, created_at, updated_at
FROM profiles
WHERE email NOT IN (SELECT email FROM users)
ORDER BY
  CASE role
    WHEN 'student' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'superadmin' THEN 3
  END;  -- Process in priority order
```

### Phase 2: Enhanced Academic Structure (`002_enhance_branches_years_semesters.sql`)
```sql
-- Add semester configuration to years
ALTER TABLE years ADD COLUMN IF NOT EXISTS total_semesters integer DEFAULT 8;
ALTER TABLE years ADD COLUMN IF NOT EXISTS program_type text DEFAULT 'btech';
ALTER TABLE years ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE years ADD COLUMN IF NOT EXISTS end_date date;

-- Add date fields to semesters
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT false;

-- Update existing data
UPDATE semesters SET display_name = 'Semester ' || semester_number::text
WHERE display_name IS NULL;
```

### Phase 3: Resource Table Split (`003_split_resources_tables.sql`)
```sql
-- Create new normalized tables
CREATE TABLE resources_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  subject text NOT NULL,
  unit integer NOT NULL,
  regulation text,
  branch_id uuid REFERENCES branches(id),
  year_id uuid REFERENCES years(id),
  semester_id uuid REFERENCES semesters(id),
  uploader_id uuid REFERENCES users(id),
  uploaded_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Migrate existing data
INSERT INTO resources_new (
  title, description, category, subject, unit, regulation,
  branch_id, year_id, semester_id, uploader_id, uploaded_at,
  deleted_at, created_at, updated_at
)
SELECT
  COALESCE(name, 'Untitled Resource') as title,
  description, category, subject, unit, regulation,
  b.id as branch_id,
  y.id as year_id,
  s.id as semester_id,
  u.id as uploader_id,
  COALESCE(date, created_at) as uploaded_at,
  deleted_at, created_at, updated_at
FROM resources r
LEFT JOIN branches b ON b.code = r.branch::text
LEFT JOIN years y ON y.batch_year = EXTRACT(YEAR FROM current_date) - (r.year - 1)
LEFT JOIN semesters s ON s.year_id = y.id AND s.semester_number = COALESCE(r.semester, 1)
LEFT JOIN users u ON u.email = (
  SELECT email FROM profiles p WHERE p.id = r.created_by
  UNION
  SELECT email FROM admins a WHERE a.id = r.created_by
  LIMIT 1
);
```

### Phase 4: Audit Logs Migration (`004_migrate_audit_logs.sql`)
```sql
-- Add new actor_id column
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_actor_id uuid REFERENCES users(id);

-- Migrate existing actor references
UPDATE audit_logs SET new_actor_id = u.id
FROM users u
WHERE audit_logs.actor_email = u.email;

-- Store old actor info in metadata for compliance
UPDATE audit_logs SET
  before_data = COALESCE(before_data, '{}'::jsonb) || jsonb_build_object(
    'legacy_actor_email', actor_email,
    'legacy_actor_role', actor_role::text
  )
WHERE new_actor_id IS NOT NULL;

-- Drop old columns after verification
-- ALTER TABLE audit_logs DROP COLUMN actor_email;
-- ALTER TABLE audit_logs DROP COLUMN actor_role;
-- ALTER TABLE audit_logs RENAME COLUMN new_actor_id TO actor_id;
```

---

## Deployment Plan & Safety Measures

### Staging Environment Setup
```bash
# Document staging database connection
STAGING_DB_URL="postgresql://user:pass@staging-host:5432/db"
PROD_DB_URL="postgresql://user:pass@prod-host:5432/db"

# Export for migration scripts
export DATABASE_URL=$STAGING_DB_URL
```

### Migration Execution Order
1. **Phase 1-3**: Schema changes (20-30 minutes downtime acceptable)
2. **Phase 4-5**: Data migration (monitor for conflicts)
3. **Phase 6**: Application code updates (zero downtime)
4. **Phase 7**: RLS policy updates (immediate)

### Rollback Strategy
```sql
-- Emergency rollback script
BEGIN;
  -- Drop new tables
  DROP TABLE IF EXISTS resource_metadata;
  DROP TABLE IF EXISTS resource_files;
  DROP TABLE IF EXISTS user_profiles;
  DROP TABLE IF EXISTS admin_profiles;

  -- Restore from backup
  ALTER TABLE resources_backup RENAME TO resources;
  ALTER TABLE audit_logs_backup RENAME TO audit_logs;

  -- Recreate original FKs
  -- ... restoration commands
COMMIT;
```

### Testing & Verification Checklist
- [ ] **Data Integrity**: Row counts match pre-migration
- [ ] **Foreign Keys**: All FK constraints satisfied
- [ ] **RLS Policies**: Access control working correctly
- [ ] **API Compatibility**: External clients unaffected
- [ ] **Performance**: Query response times within 10% of baseline
- [ ] **Audit Trail**: All actions properly logged with new actor references

### Timeline & Risk Assessment
- **Total Migration Time**: 2-4 hours
- **Downtime Window**: 20-30 minutes (during schema switches)
- **Rollback Time**: < 15 minutes
- **Risk Level**: MEDIUM (thorough staging testing required)
- **Business Impact**: LOW (with proper staging validation)

---

## RLS Policy Updates Required

### Updated Policies for New Schema
```sql
-- Users table policies
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- Resources policies (now support all user types)
CREATE POLICY "Users can read relevant resources" ON resources
  FOR SELECT USING (
    uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR branch_id IN (
      SELECT up.branch_id FROM user_profiles up
      WHERE up.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );
```

---

## Success Metrics & Monitoring

### Post-Migration Validation Queries
```sql
-- Verify user consolidation
SELECT 'Users consolidated:' as check, COUNT(*) as count FROM users;
SELECT 'Total user profiles:' as check, COUNT(*) as count FROM user_profiles;
SELECT 'Admin profiles:' as check, COUNT(*) as count FROM admin_profiles;

-- Verify resource normalization
SELECT 'Resources migrated:' as check, COUNT(*) as count FROM resources;
SELECT 'Resource files:' as check, COUNT(*) as count FROM resource_files;
SELECT 'Resource metadata:' as check, COUNT(*) as count FROM resource_metadata;

-- Check FK integrity
SELECT 'Orphaned resources:' as check, COUNT(*) as count
FROM resources r
LEFT JOIN users u ON r.uploader_id = u.id
WHERE u.id IS NULL;
```

### Performance Benchmarks
- **Target**: < 100ms for resource listing queries
- **Target**: < 50ms for user profile lookups
- **Target**: < 200ms for audit log queries

---

## Conclusion & Next Steps

This migration plan addresses all 6 red flags while maintaining production stability. The phased approach minimizes risk and provides clear rollback paths.

**Immediate Actions Required:**
1. Set up staging environment with production data copy
2. Execute migrations in staging and validate thoroughly
3. Schedule 2-hour maintenance window for production deployment
4. Prepare rollback scripts and backup verification

**Long-term Benefits:**
- Unified identity management eliminates sync issues
- Normalized schema prevents data drift
- Flexible academic modeling supports future program types
- Complete audit trail for compliance
- Better performance through proper indexing

**Risk Mitigation:**
- External client compatibility maintained through enum preservation
- Comprehensive staging testing before production
- < 30 minute downtime window
- Immediate rollback capability

Ready to proceed with migration file creation and staging setup?
