-- Database Refactoring Phase 1: Create New Lookup Tables
-- This migration creates the new normalized lookup tables to replace ENUM-based approach

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Phase 1.1: Create branches lookup table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Migrate existing branch enum values
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

-- Phase 1.2: Create years lookup table
CREATE TABLE IF NOT EXISTS years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_year integer NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert current academic years (adjust as needed)
INSERT INTO years (batch_year, display_name) VALUES
  (2024, '2024-25 Batch'),
  (2023, '2023-24 Batch'),
  (2022, '2022-23 Batch'),
  (2021, '2021-22 Batch')
ON CONFLICT (batch_year) DO NOTHING;

-- Phase 1.3: Create semesters lookup table
CREATE TABLE IF NOT EXISTS semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_number integer NOT NULL CHECK (semester_number IN (1, 2)),
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semester_number, year_id)
);

-- Populate semesters for each year
INSERT INTO semesters (semester_number, year_id)
SELECT 
  sem.semester_number,
  y.id as year_id
FROM years y
CROSS JOIN (VALUES (1), (2)) AS sem(semester_number)
ON CONFLICT (semester_number, year_id) DO NOTHING;

-- Phase 1.4: Create academic calendar for semester progression control
CREATE TABLE IF NOT EXISTS academic_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_year_id uuid NOT NULL REFERENCES years(id) ON DELETE RESTRICT,
  current_semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
  last_updated timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  singleton boolean DEFAULT true NOT NULL,
  UNIQUE (singleton)
);

-- Set initial academic calendar (adjust current year/semester as needed)
INSERT INTO academic_calendar (current_year_id, current_semester_id, singleton)
SELECT 
  y.id as current_year_id,
  s.id as current_semester_id,
  true as singleton
FROM years y
JOIN semesters s ON s.year_id = y.id
WHERE y.batch_year = 2024 AND s.semester_number = 1
ON CONFLICT (singleton) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_semesters_year ON semesters(year_id);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_current_year ON academic_calendar(current_year_id);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_current_semester ON academic_calendar(current_semester_id);

-- Verification queries
SELECT 'Branches created:' as status, COUNT(*) as count FROM branches;
SELECT 'Years created:' as status, COUNT(*) as count FROM years;
SELECT 'Semesters created:' as status, COUNT(*) as count FROM semesters;
SELECT 'Academic calendar entries:' as status, COUNT(*) as count FROM academic_calendar;
