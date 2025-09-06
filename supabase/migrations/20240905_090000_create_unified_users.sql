-- Migration 001: Create Unified Users Table
-- Addresses Red Flag #2: Profiles vs Students vs Admins Duplication
-- Creates canonical users table with independent UUID PK, stores auth_user_id as FK

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure user_role enum exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    CREATE TYPE user_role AS ENUM ('student', 'admin', 'superadmin');
  END IF;
END $$;

-- Create canonical users table (single source of truth for all identities)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,  -- FK to auth.users.id (future-proofs against auth changes)
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Soft delete for audit compliance
  deleted_at timestamptz,

  -- Constraints
  UNIQUE (auth_user_id),
  UNIQUE (email)
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Phase 1.2: Migrate existing data with conflict resolution
-- Priority order: profiles > students > admins (as specified)

-- Step 1: Migrate from profiles table (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
  ) THEN
    INSERT INTO users (auth_user_id, email, name, role, created_at, updated_at)
    SELECT
      gen_random_uuid() as auth_user_id,
      email, name, role::user_role, created_at, updated_at
    FROM profiles
    WHERE email NOT IN (SELECT email FROM users)
    ORDER BY
      CASE role
        WHEN 'student' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'superadmin' THEN 3
      END;
    RAISE NOTICE 'Migrated % profiles', (SELECT COUNT(*) FROM profiles);
  ELSE
    RAISE NOTICE 'profiles table does not exist, skipping profile migration';
  END IF;
END $$;

-- Step 2: Migrate from students table (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'students'
  ) THEN
    INSERT INTO users (auth_user_id, email, name, role, created_at, updated_at)
    SELECT
      gen_random_uuid() as auth_user_id,
      s.email, s.name, 'student'::user_role, s.created_at, s.updated_at
    FROM students s
    WHERE s.email NOT IN (SELECT email FROM users)
    AND s.email IS NOT NULL;
    RAISE NOTICE 'Migrated % students', (SELECT COUNT(*) FROM students);
  ELSE
    RAISE NOTICE 'students table does not exist, skipping student migration';
  END IF;
END $$;

-- Step 3: Migrate from admins table (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'admins'
  ) THEN
    INSERT INTO users (auth_user_id, email, name, role, created_at, updated_at)
    SELECT
      gen_random_uuid() as auth_user_id,
      a.email,
      COALESCE(a.email, 'Admin User') as name,
      CASE
        WHEN a.role = 'superadmin' THEN 'superadmin'::user_role
        ELSE 'admin'::user_role
      END,
      a.created_at, now() as updated_at
    FROM admins a
    WHERE a.email NOT IN (SELECT email FROM users);
    RAISE NOTICE 'Migrated % admins', (SELECT COUNT(*) FROM admins);
  ELSE
    RAISE NOTICE 'admins table does not exist, skipping admin migration';
  END IF;
END $$;

DO $$
BEGIN
  -- Only create user_profiles if dependent tables exist
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='branches'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='years'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='semesters'
  ) THEN
    CREATE TABLE IF NOT EXISTS user_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      roll_number text UNIQUE,
      branch_id uuid REFERENCES branches(id),
      year_id uuid REFERENCES years(id),
      semester_id uuid REFERENCES semesters(id),
      section text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),

      -- Constraints
      UNIQUE (user_id)
    );

    -- Add trigger for user_profiles
    DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
    CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  ELSE
    RAISE NOTICE 'Skipping user_profiles creation until branches/years/semesters exist';
  END IF;
END $$;

-- Migrate profile data to user_profiles (if profiles table exists)
DO $$
BEGIN
  -- Perform migration only if both user_profiles and source deps exist
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles'
  ) THEN
    INSERT INTO user_profiles (user_id, roll_number, branch_id, year_id, semester_id, section, created_at, updated_at)
    SELECT
      u.id as user_id,
      p.roll_number,
      b.id as branch_id,
      y.id as year_id,
      s.id as semester_id,
      NULL as section,
      p.created_at,
      p.updated_at
    FROM profiles p
    JOIN users u ON u.email = p.email
    LEFT JOIN branches b ON b.code = p.branch::text
    LEFT JOIN years y ON y.batch_year = (EXTRACT(YEAR FROM current_date) - (p.year - 1))
    LEFT JOIN semesters s ON s.year_id = y.id AND s.semester_number = 1
    WHERE p.role = 'student'
    ON CONFLICT (user_id) DO NOTHING;
    RAISE NOTICE 'Migrated profile data to user_profiles';
  ELSE
    RAISE NOTICE 'Skipping user_profiles migration until dependencies exist';
  END IF;
END $$;

-- Phase 1.4: Create admin_profiles table (extends users for admin-specific data)
CREATE TABLE IF NOT EXISTS admin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_scope jsonb,  -- Store branch/year restrictions as JSON
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (user_id)  -- One admin profile per user
);

-- Migrate admin scope data from admin_scopes table (if it exists)
DO $$
BEGIN
  -- Check if admin_scopes table exists before trying to migrate
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'admin_scopes'
  ) THEN
    -- Migrate admin scope data
    INSERT INTO admin_profiles (user_id, admin_scope, created_at)
    SELECT
      u.id as user_id,
      jsonb_build_object(
        'year', sc.year,
        'branch', sc.branch::text,
        'scope_type', 'scoped'
      ) as admin_scope,
      sc.created_at
    FROM admin_scopes sc
    JOIN admins a ON a.id = sc.admin_id
    JOIN users u ON u.email = a.email
    ON CONFLICT (user_id) DO NOTHING; 

    RAISE NOTICE 'Migrated admin scope data from admin_scopes table';
  ELSE
    RAISE NOTICE 'admin_scopes table does not exist, skipping scope migration';
  END IF;
END $$;

-- Migrate unscoped admins (no admin_scopes entry)
INSERT INTO admin_profiles (user_id, admin_scope, created_at)
SELECT
  u.id as user_id,
  jsonb_build_object('scope_type', 'global') as admin_scope,
  u.created_at
FROM users u
WHERE u.role IN ('admin', 'superadmin')
AND u.id NOT IN (SELECT user_id FROM admin_profiles)
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE cnt bigint;
BEGIN
  RAISE NOTICE '=== MIGRATION 001 VERIFICATION ===';

  SELECT COUNT(*) INTO cnt FROM users;
  RAISE NOTICE 'Users created: %', cnt;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles'
  ) THEN
    SELECT COUNT(*) INTO cnt FROM user_profiles;
    RAISE NOTICE 'User profiles created: %', cnt;

    SELECT COUNT(*) INTO cnt FROM admin_profiles;
    RAISE NOTICE 'Admin profiles created: %', cnt;

    SELECT COUNT(*) INTO cnt
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    WHERE up.id IS NULL AND u.role = 'student';
    RAISE NOTICE 'Users without profiles (expected for admins): %', cnt;
  ELSE
    RAISE NOTICE 'Skipping user_profiles-related verification until dependencies exist';
  END IF;
END $$;

COMMIT;

-- Post-migration notes:
-- 1. Update application code to use users.id as canonical user identifier
-- 2. Update RLS policies to reference users table
-- 3. Consider updating auth_user_id values to actual auth.users.id values
-- 4. Keep old tables as backup until next migration phase
