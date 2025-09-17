-- Add missing FK constraints on profiles.branch_id/year_id/semester_id and supporting indexes
-- Safe to re-run: guarded by IF NOT EXISTS checks on pg_constraint and pg_indexes

BEGIN;

-- Ensure columns exist with correct types
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS semester_id uuid;

-- Add missing foreign keys if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_branch_id_fkey'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_year_id_fkey'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_year_id_fkey
      FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_semester_id_fkey'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_semester_id_fkey
      FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Helpful indexes for join/filter performance (no-op if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_branch_id'
  ) THEN
    CREATE INDEX idx_profiles_branch_id ON profiles(branch_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_year_id'
  ) THEN
    CREATE INDEX idx_profiles_year_id ON profiles(year_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_semester_id'
  ) THEN
    CREATE INDEX idx_profiles_semester_id ON profiles(semester_id);
  END IF;
END $$;

COMMIT;


