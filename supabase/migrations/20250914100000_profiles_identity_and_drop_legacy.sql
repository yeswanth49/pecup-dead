-- Profiles identity canonicalization and legacy cleanup
-- - Add google_sub
-- - Enforce CI-unique email via unique index
-- - Ensure FK constraints on academic fields with ON DELETE RESTRICT
-- - Adjust role enum values (rename superadmin -> yeshh, add representative)
-- - Make role default NULL
-- - Add helpful indexes
-- - Enable RLS and add baseline policies
-- - Drop legacy tables: users, user_profiles, admin_profiles, students, admins

BEGIN;

-- 1) Column: google_sub (Google OIDC subject) - optional and unique
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_google_sub ON profiles(google_sub) WHERE google_sub IS NOT NULL;

-- 2) Email NOT NULL and CI-unique via unique index (preferred over constraint on expression)
ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;
-- Replace any old CI-unique index with a consistently named one
DROP INDEX IF EXISTS ux_profiles_email_ci;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON profiles (lower(email));

-- 3) Ensure academic FKs exist with ON DELETE RESTRICT
-- Columns (idempotent)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS semester_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roll_number text;

-- Foreign keys with RESTRICT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_branch_id_fkey') THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_year_id_fkey') THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_year_id_fkey FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_semester_id_fkey') THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 4) Indexes for performance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_branch_id') THEN
    CREATE INDEX idx_profiles_branch_id ON profiles(branch_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_year_id') THEN
    CREATE INDEX idx_profiles_year_id ON profiles(year_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_semester_id') THEN
    CREATE INDEX idx_profiles_semester_id ON profiles(semester_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_roll_number_unique') THEN
    CREATE UNIQUE INDEX idx_profiles_roll_number_unique ON profiles(roll_number) WHERE roll_number IS NOT NULL;
  END IF;
END $$;

-- 5) Roles: ensure enum covers representative/admin/yeshh/student; rename superadmin -> yeshh
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('student', 'admin', 'yeshh', 'representative');
  ELSE
    -- Add representative if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'representative'
    ) THEN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'representative';
    END IF;
    -- Add yeshh if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'yeshh'
    ) THEN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'yeshh';
    END IF;
    -- Rename superadmin to yeshh if superadmin exists
    IF EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'superadmin'
    ) THEN
      BEGIN
        ALTER TYPE user_role RENAME VALUE 'superadmin' TO 'yeshh';
      EXCEPTION WHEN duplicate_object THEN
        -- Value already renamed; ignore
        NULL;
      END;
    END IF;
  END IF;
END $$;

-- 6) Make profiles.role nullable with no default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    BEGIN
      ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;
    EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN
      ALTER TABLE profiles ALTER COLUMN role DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;
END $$;

-- 7) Enable RLS and add baseline policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicates (no-op if absent)
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_read_self';
  IF FOUND THEN EXECUTE 'DROP POLICY profiles_read_self ON profiles'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_self';
  IF FOUND THEN EXECUTE 'DROP POLICY profiles_update_self ON profiles'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_admin_all';
  IF FOUND THEN EXECUTE 'DROP POLICY profiles_admin_all ON profiles'; END IF;
END $$;

-- Self can read own row by email from JWT (Supabase Auth only; service role bypasses RLS)
CREATE POLICY profiles_read_self ON profiles
  FOR SELECT
  USING (
    (auth.jwt() IS NOT NULL) AND lower(email) = lower((auth.jwt() ->> 'email'))
  );

-- Self can update own row (limited to safe cols if desired; here allow full for simplicity)
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE
  USING (
    (auth.jwt() IS NOT NULL) AND lower(email) = lower((auth.jwt() ->> 'email'))
  );

-- Admin/yeshh can do anything
CREATE POLICY profiles_admin_all ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE lower(p2.email) = lower((auth.jwt() ->> 'email'))
        AND p2.role IN ('admin'::user_role, 'yeshh'::user_role)
    )
  );

-- 8) Drop legacy tables if they exist (safe in dev; you confirmed backups exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN
    EXECUTE 'DROP TABLE IF EXISTS users CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles') THEN
    EXECUTE 'DROP TABLE IF EXISTS user_profiles CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_profiles') THEN
    EXECUTE 'DROP TABLE IF EXISTS admin_profiles CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='students') THEN
    EXECUTE 'DROP TABLE IF EXISTS students CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='admins') THEN
    EXECUTE 'DROP TABLE IF EXISTS admins CASCADE';
  END IF;
END $$;

COMMIT;


