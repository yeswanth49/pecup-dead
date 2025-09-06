-- Migration 002: Enhanced Branches, Years, and Semesters
-- Addresses Red Flag #1: Inconsistent Branch/Year/Semester Representation
-- Addresses Red Flag #3: Years & Semesters Fragile Modeling
-- Standardizes on FK relationships, adds configurable semester support

BEGIN;

-- Phase 2.1: Ensure branches table exists and is properly structured
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Migrate existing branch enum values (if not already done)
INSERT INTO branches (name, code) VALUES
  ('Computer Science Engineering', 'CSE'),
  ('Artificial Intelligence & Machine Learning', 'AIML'),
  ('Data Science', 'DS'),
  ('Artificial Intelligence', 'AI'),
  ('Electronics & Communication Engineering', 'ECE'),
  ('Electrical & Electronics Engineering', 'EEE'),
  ('Mechanical Engineering', 'MEC'),
  ('Civil Engineering', 'CE')
ON CONFLICT (code) DO NOTHING;

-- Phase 2.2: Enhance years table with configurable semester support
CREATE TABLE IF NOT EXISTS years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_year integer NOT NULL UNIQUE,
  display_name text NOT NULL,
  program_type text NOT NULL DEFAULT 'btech',
  total_semesters integer NOT NULL DEFAULT 8,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns to existing years table if it already exists
ALTER TABLE years ADD COLUMN IF NOT EXISTS program_type text DEFAULT 'btech';
ALTER TABLE years ADD COLUMN IF NOT EXISTS total_semesters integer DEFAULT 8;
ALTER TABLE years ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE years ADD COLUMN IF NOT EXISTS end_date date;

-- Insert current academic years (update as needed for your institution)
INSERT INTO years (batch_year, display_name, program_type, total_semesters, start_date, end_date) VALUES
  (2024, '2024-25 Batch', 'btech', 8, '2024-07-01', '2028-06-30'),
  (2023, '2023-24 Batch', 'btech', 8, '2023-07-01', '2027-06-30'),
  (2022, '2022-23 Batch', 'btech', 8, '2022-07-01', '2026-06-30'),
  (2021, '2021-22 Batch', 'btech', 8, '2021-07-01', '2025-06-30'),
  (2025, '2025-26 Batch', 'btech', 8, '2025-07-01', '2029-06-30')
ON CONFLICT (batch_year) DO NOTHING;

-- Phase 2.3: Enhance semesters table with flexible semester support
CREATE TABLE IF NOT EXISTS semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  semester_number integer NOT NULL,
  display_name text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (year_id, semester_number)
);

-- Remove restrictive check constraint if it exists
DO $$
BEGIN
  -- Check if the old check constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
    AND constraint_name = 'semesters_semester_number_check'
    AND check_clause LIKE '%semester_number IN (1, 2)%'
  ) THEN
    ALTER TABLE semesters DROP CONSTRAINT semesters_semester_number_check;
    RAISE NOTICE 'Dropped restrictive semester_number check constraint from semesters table';
  END IF;

  -- Also check for any other tables that might have similar constraints
  -- This is informational - these would need to be handled in future migrations
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
    AND check_clause LIKE '%semester IN (1, 2)%'
  ) THEN
    RAISE NOTICE 'WARNING: Other tables may have restrictive semester constraints that should be reviewed';
  END IF;
END $$;

-- Add missing columns to existing semesters table if it already exists
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT false;

-- Update display_name for existing records that don't have it
UPDATE semesters SET display_name = 'Semester ' || semester_number::text
WHERE display_name IS NULL;

-- Add updated_at trigger to semesters
DROP TRIGGER IF EXISTS trg_semesters_updated_at ON semesters;
CREATE TRIGGER trg_semesters_updated_at
BEFORE UPDATE ON semesters
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Populate semesters for each year (8 semesters per 4-year program)
INSERT INTO semesters (year_id, semester_number, display_name, start_date, end_date)
SELECT
  y.id as year_id,
  sem.semester_number,
  'Semester ' || sem.semester_number::text as display_name,
  CASE
    WHEN sem.semester_number = 1 THEN y.start_date
    WHEN sem.semester_number = 2 THEN (y.start_date + INTERVAL '6 months')
    WHEN sem.semester_number = 3 THEN (y.start_date + INTERVAL '12 months')
    WHEN sem.semester_number = 4 THEN (y.start_date + INTERVAL '18 months')
    WHEN sem.semester_number = 5 THEN (y.start_date + INTERVAL '24 months')
    WHEN sem.semester_number = 6 THEN (y.start_date + INTERVAL '30 months')
    WHEN sem.semester_number = 7 THEN (y.start_date + INTERVAL '36 months')
    WHEN sem.semester_number = 8 THEN (y.start_date + INTERVAL '42 months')
    ELSE y.start_date
  END as start_date,
  CASE
    WHEN sem.semester_number = 1 THEN (y.start_date + INTERVAL '5 months 29 days')
    WHEN sem.semester_number = 2 THEN (y.start_date + INTERVAL '11 months 29 days')
    WHEN sem.semester_number = 3 THEN (y.start_date + INTERVAL '17 months 29 days')
    WHEN sem.semester_number = 4 THEN (y.start_date + INTERVAL '23 months 29 days')
    WHEN sem.semester_number = 5 THEN (y.start_date + INTERVAL '29 months 29 days')
    WHEN sem.semester_number = 6 THEN (y.start_date + INTERVAL '35 months 29 days')
    WHEN sem.semester_number = 7 THEN (y.start_date + INTERVAL '41 months 29 days')
    WHEN sem.semester_number = 8 THEN (y.end_date)
    ELSE y.end_date
  END as end_date
FROM years y
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6), (7), (8)) AS sem(semester_number)
ON CONFLICT (year_id, semester_number) DO NOTHING;

-- Phase 2.4: Create or enhance academic calendar
CREATE TABLE IF NOT EXISTS academic_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_year_id uuid REFERENCES years(id),
  current_semester_id uuid REFERENCES semesters(id),
  singleton boolean DEFAULT true NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Ensure only one active calendar
  UNIQUE (singleton)
);

-- Add missing columns to existing academic_calendar table if it already exists
ALTER TABLE academic_calendar ADD COLUMN IF NOT EXISTS current_year_id uuid REFERENCES years(id);
ALTER TABLE academic_calendar ADD COLUMN IF NOT EXISTS current_semester_id uuid REFERENCES semesters(id);
ALTER TABLE academic_calendar ADD COLUMN IF NOT EXISTS singleton boolean DEFAULT true;
ALTER TABLE academic_calendar ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Clean up duplicate singleton values and add unique constraint if it doesn't exist
DO $$
BEGIN
  -- First, clean up duplicates by keeping only the most recent entry
  IF EXISTS (
    SELECT 1 FROM academic_calendar
    WHERE singleton = true
    GROUP BY singleton
    HAVING COUNT(*) > 1
  ) THEN
    -- Keep the most recent entry and delete others
    DELETE FROM academic_calendar
    WHERE id NOT IN (
      SELECT DISTINCT ON (singleton) id
      FROM academic_calendar
      WHERE singleton = true
      ORDER BY singleton, updated_at DESC
    );
    RAISE NOTICE 'Cleaned up duplicate singleton entries in academic_calendar';
  END IF;

  -- Now add the unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'academic_calendar'::regclass
    AND conname = 'academic_calendar_singleton_key'
  ) THEN
    ALTER TABLE academic_calendar ADD CONSTRAINT academic_calendar_singleton_key UNIQUE (singleton);
    RAISE NOTICE 'Added unique constraint on singleton column';
  END IF;
END $$;

-- Set initial academic calendar (adjust current year/semester as needed)
-- Only insert if we can find the required year and semester
DO $$
BEGIN
  -- Check if we have the required year and semester records
  IF EXISTS (
    SELECT 1 FROM years y
    JOIN semesters s ON s.year_id = y.id
    WHERE y.batch_year = 2024 AND s.semester_number = 1
  ) THEN
    INSERT INTO academic_calendar (current_year_id, current_semester_id, singleton)
    SELECT
      y.id as current_year_id,
      s.id as current_semester_id,
      true as singleton
    FROM years y
    JOIN semesters s ON s.year_id = y.id
    WHERE y.batch_year = 2024 AND s.semester_number = 1
    ON CONFLICT (singleton) DO NOTHING;

    RAISE NOTICE 'Academic calendar initialized with 2024 Semester 1';
  ELSE
    -- Fallback: try to find any year/semester combination
    INSERT INTO academic_calendar (current_year_id, current_semester_id, singleton)
    SELECT
      y.id as current_year_id,
      s.id as current_semester_id,
      true as singleton
    FROM years y
    JOIN semesters s ON s.year_id = y.id
    ORDER BY y.batch_year DESC, s.semester_number ASC
    LIMIT 1
    ON CONFLICT (singleton) DO NOTHING;

    RAISE NOTICE 'Academic calendar initialized with fallback year/semester';
  END IF;
END $$;

-- Add trigger for academic_calendar
DROP TRIGGER IF EXISTS trg_academic_calendar_updated_at ON academic_calendar;
CREATE TRIGGER trg_academic_calendar_updated_at
BEFORE UPDATE ON academic_calendar
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Phase 2.5: Create helper functions for semester management

-- Function to get current semester
CREATE OR REPLACE FUNCTION get_current_semester()
RETURNS uuid AS $$
DECLARE
  current_semester_id uuid;
BEGIN
  SELECT current_semester_id INTO current_semester_id
  FROM academic_calendar
  WHERE singleton = true;

  RETURN current_semester_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get current year
CREATE OR REPLACE FUNCTION get_current_year()
RETURNS uuid AS $$
DECLARE
  current_year_id uuid;
BEGIN
  SELECT current_year_id INTO current_year_id
  FROM academic_calendar
  WHERE singleton = true;

  RETURN current_year_id;
END;
$$ LANGUAGE plpgsql;

-- Phase 2.6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_semesters_year ON semesters(year_id);
CREATE INDEX IF NOT EXISTS idx_semesters_year_semester ON semesters(year_id, semester_number);
CREATE INDEX IF NOT EXISTS idx_semesters_current ON semesters(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_years_batch_year ON years(batch_year);
CREATE INDEX IF NOT EXISTS idx_years_program_type ON years(program_type);
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_current_year ON academic_calendar(current_year_id);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_current_semester ON academic_calendar(current_semester_id);

-- Phase 2.7: Update existing tables to use FKs instead of enums/raw values
-- This will be done in subsequent migrations to maintain backwards compatibility

-- Phase 2.8: Verification queries
SELECT '=== MIGRATION 002 VERIFICATION ===' as section;
SELECT 'Branches created:' as check, COUNT(*) as count FROM branches;
SELECT 'Years created:' as check, COUNT(*) as count FROM years;
SELECT 'Semesters created:' as check, COUNT(*) as count FROM semesters;
SELECT 'Academic calendar entries:' as check, COUNT(*) as count FROM academic_calendar;

-- Verify semester distribution
SELECT
  'Semesters per year:' as check,
  y.batch_year,
  COUNT(s.id) as semester_count
FROM years y
LEFT JOIN semesters s ON y.id = s.year_id
GROUP BY y.id, y.batch_year
ORDER BY y.batch_year;

-- Show current academic context
SELECT
  'Current academic year:' as check,
  y.batch_year,
  y.display_name
FROM academic_calendar ac
JOIN years y ON ac.current_year_id = y.id
WHERE ac.singleton = true;

SELECT
  'Current semester:' as check,
  s.semester_number,
  s.display_name,
  s.start_date,
  s.end_date
FROM academic_calendar ac
JOIN semesters s ON ac.current_semester_id = s.id
WHERE ac.singleton = true;

COMMIT;

-- Post-migration notes:
-- 1. Verify semester date ranges are correct for your institution
-- 2. Update get_current_semester() function if your current semester is different
-- 3. Next migration will update existing tables to use these FK relationships
-- 4. Consider adding semester transition logic for automated calendar updates
-- 5. Note: Removed restrictive check constraint allowing flexible semester numbering (1-8 instead of 1-2)
-- 6. If you have other tables with similar constraints (like subject_offerings), they may need updates in future migrations

-- Ensure user_profiles exists now that dependencies are present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles'
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
      UNIQUE (user_id)
    );

    DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
    CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
