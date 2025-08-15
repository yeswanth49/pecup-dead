-- Database Refactoring Phase 2: Create New Students Table
-- This migration creates the students table to replace profiles with proper foreign key relationships

-- Phase 2.1: Create students table with proper relationships
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE RESTRICT,
  semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
  section text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_year ON students(year_id);
CREATE INDEX IF NOT EXISTS idx_students_semester ON students(semester_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);

-- Add updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Phase 2.2: Migrate data from profiles to students
-- Note: This query maps the current year numbers (1,2,3,4) to batch years (2024,2023,2022,2021)
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
  NULL as section, -- Will need to be populated separately
  p.created_at,
  p.updated_at
FROM profiles p
JOIN branches b ON b.code = p.branch::text
JOIN years y ON y.batch_year = (
  CASE 
    WHEN p.year = 1 THEN 2024
    WHEN p.year = 2 THEN 2023
    WHEN p.year = 3 THEN 2022
    WHEN p.year = 4 THEN 2021
    ELSE 2024
  END
)
JOIN semesters s ON s.year_id = y.id AND s.semester_number = 1 -- Default to semester 1
WHERE p.role = 'student' -- Only migrate students, not admins
ON CONFLICT (roll_number) DO NOTHING;

-- Phase 2.3: Verification and data integrity checks
-- Check migration results
SELECT 'Original profiles (students only):' as status, COUNT(*) as count 
FROM profiles WHERE role = 'student';

SELECT 'Migrated students:' as status, COUNT(*) as count FROM students;

-- Check for any unmigrated profiles
SELECT 'Unmigrated profiles:' as status, COUNT(*) as count
FROM profiles p 
WHERE p.role = 'student' 
AND NOT EXISTS (
  SELECT 1 FROM students s WHERE s.email = p.email
);

-- Show sample migrated data with relationships
SELECT 
  s.roll_number,
  s.name,
  s.email,
  b.code as branch_code,
  b.name as branch_name,
  y.batch_year,
  sem.semester_number,
  s.section
FROM students s
JOIN branches b ON s.branch_id = b.id
JOIN years y ON s.year_id = y.id
JOIN semesters sem ON s.semester_id = sem.id
LIMIT 5;
