-- Migration script to move existing profiles to students table
-- This script migrates users from the old profiles table to the new students table

-- First, let's map the old year values to the new year IDs
-- Assuming the old year values are batch years (2023, 2024, etc.)

INSERT INTO students (
  roll_number,
  name,
  email,
  branch_id,
  year_id,
  semester_id,
  section,
  created_at,
  updated_at
)
SELECT
  p.roll_number,
  p.name,
  p.email,
  b.id as branch_id,
  y.id as year_id,
  s.id as semester_id,
  NULL as section, -- No section data in old profiles
  p.created_at,
  p.updated_at
FROM profiles p
JOIN branches b ON b.code = p.branch::text
JOIN years y ON y.batch_year = p.year
JOIN semesters s ON s.year_id = y.id AND s.semester_number = 1 -- Default to semester 1
WHERE NOT EXISTS (
  SELECT 1 FROM students s2 WHERE s2.email = p.email
);

-- Verify the migration
SELECT
  'Migration completed' as status,
  COUNT(*) as profiles_migrated
FROM students s
WHERE s.email IN (SELECT email FROM profiles);

-- Optional: Create a backup of old profiles (uncomment if needed)
-- CREATE TABLE profiles_backup AS SELECT * FROM profiles;
