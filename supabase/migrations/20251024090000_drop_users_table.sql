-- Migration: Drop users table and related tables to resolve inconsistency
-- Purpose: Remove unused 'users' table and keep 'profiles' as canonical
-- Since the codebase exclusively uses 'profiles', this resolves the count mismatch (112 in users vs 106 in profiles)

BEGIN;

-- Drop dependent tables first
DROP TABLE IF EXISTS admin_profiles CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop the main users table
DROP TABLE IF EXISTS users CASCADE;

-- Drop related triggers and functions if they exist
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- Drop indexes if they exist (optional, as CASCADE on table drop should handle this)
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_auth_user_id;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_deleted_at;

-- Drop the user_role enum if it's no longer used (check if other tables use it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE data_type = 'user_role'
  ) THEN
    DROP TYPE IF EXISTS user_role;
  END IF;
END $$;

COMMIT;

-- Verification notice
DO $$
BEGIN
  RAISE NOTICE 'Successfully dropped users, user_profiles, and admin_profiles tables.';
  RAISE NOTICE 'The application now uses profiles as the single source of truth for user data.';
  RAISE NOTICE 'Please verify that all user-related functionality works as expected.';
END $$;