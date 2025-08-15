-- Database Refactoring Phase 3: Add New Columns to Resources Table and Migrate Data
-- This migration adds new foreign key columns to resources and migrates existing data

-- Phase 3.1: Add new foreign key columns to resources table
ALTER TABLE resources ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS drive_link text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS year_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS semester_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS uploader_id uuid;

-- Add foreign key constraints
DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT fk_resources_branch 
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT fk_resources_year 
    FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT fk_resources_semester 
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT fk_resources_uploader 
    FOREIGN KEY (uploader_id) REFERENCES students(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Phase 3.2: Migrate existing data to new columns
UPDATE resources SET 
  title = name,
  drive_link = url,
  file_type = COALESCE(type, 'unknown')
WHERE title IS NULL OR drive_link IS NULL OR file_type IS NULL;

-- Migrate branch data
UPDATE resources SET 
  branch_id = (SELECT id FROM branches WHERE code = resources.branch::text)
WHERE branch_id IS NULL AND resources.branch IS NOT NULL;

-- Migrate year data (map current year numbers to batch years)
UPDATE resources SET 
  year_id = (SELECT id FROM years WHERE batch_year = 
    CASE 
      WHEN resources.year = 1 THEN 2024
      WHEN resources.year = 2 THEN 2023
      WHEN resources.year = 3 THEN 2022
      WHEN resources.year = 4 THEN 2021
      ELSE 2024
    END
  )
WHERE year_id IS NULL AND resources.year IS NOT NULL;

-- Migrate semester data
UPDATE resources SET 
  semester_id = (
    SELECT s.id FROM semesters s 
    JOIN years y ON s.year_id = y.id 
    WHERE s.semester_number = COALESCE(resources.semester, 1)
    AND y.batch_year = 
      CASE 
        WHEN resources.year = 1 THEN 2024
        WHEN resources.year = 2 THEN 2023
        WHEN resources.year = 3 THEN 2022
        WHEN resources.year = 4 THEN 2021
        ELSE 2024
      END
  )
WHERE semester_id IS NULL;

-- Note: uploader_id will remain NULL since current resources are admin-uploaded
-- Future resources will be student-uploaded and this field will be populated by the application

-- Create indexes for the new foreign key columns
CREATE INDEX IF NOT EXISTS idx_resources_branch_id ON resources(branch_id);
CREATE INDEX IF NOT EXISTS idx_resources_year_id ON resources(year_id);
CREATE INDEX IF NOT EXISTS idx_resources_semester_id ON resources(semester_id);
CREATE INDEX IF NOT EXISTS idx_resources_uploader_id ON resources(uploader_id);
CREATE INDEX IF NOT EXISTS idx_resources_title ON resources(title);

-- Phase 3.3: Data validation
-- Check migration results
SELECT 'Total resources:' as status, COUNT(*) as count FROM resources;

SELECT 'Resources with new columns populated:' as status, 
  COUNT(*) as count 
FROM resources 
WHERE title IS NOT NULL 
  AND drive_link IS NOT NULL 
  AND file_type IS NOT NULL 
  AND branch_id IS NOT NULL 
  AND year_id IS NOT NULL 
  AND semester_id IS NOT NULL;

-- Check for any resources without proper foreign key references
SELECT 
  COUNT(*) as total_resources,
  COUNT(branch_id) as with_branch,
  COUNT(year_id) as with_year,
  COUNT(semester_id) as with_semester,
  COUNT(uploader_id) as with_uploader
FROM resources;

-- Check for orphaned references
SELECT 'branches' as table_name, COUNT(*) as orphaned
FROM resources r LEFT JOIN branches b ON r.branch_id = b.id 
WHERE r.branch_id IS NOT NULL AND b.id IS NULL
UNION ALL
SELECT 'years', COUNT(*)
FROM resources r LEFT JOIN years y ON r.year_id = y.id 
WHERE r.year_id IS NOT NULL AND y.id IS NULL
UNION ALL
SELECT 'semesters', COUNT(*)
FROM resources r LEFT JOIN semesters s ON r.semester_id = s.id 
WHERE r.semester_id IS NOT NULL AND s.id IS NULL
UNION ALL
SELECT 'students', COUNT(*)
FROM resources r LEFT JOIN students st ON r.uploader_id = st.id 
WHERE r.uploader_id IS NOT NULL AND st.id IS NULL;

-- Show sample migrated data with relationships
SELECT 
  r.title,
  r.file_type,
  b.code as branch_code,
  y.batch_year,
  s.semester_number,
  r.created_at
FROM resources r
LEFT JOIN branches b ON r.branch_id = b.id
LEFT JOIN years y ON r.year_id = y.id
LEFT JOIN semesters s ON r.semester_id = s.id
WHERE r.branch_id IS NOT NULL
LIMIT 5;
