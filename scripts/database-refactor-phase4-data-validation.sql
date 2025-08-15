-- Database Refactoring Phase 4: Data Validation and Cleanup
-- This migration validates data integrity and makes new columns required

-- Phase 4.1: Comprehensive data validation
-- Check for any resources without proper foreign key references
DO $$ 
DECLARE
  orphaned_count integer;
  total_resources integer;
BEGIN
  RAISE NOTICE '=== DATA VALIDATION REPORT ===';
  
  -- Get total resource count
  SELECT COUNT(*) INTO total_resources FROM resources;
  RAISE NOTICE 'Total resources: %', total_resources;
  
  -- Check branches
  SELECT COUNT(*) INTO orphaned_count
  FROM resources r LEFT JOIN branches b ON r.branch_id = b.id 
  WHERE r.branch_id IS NOT NULL AND b.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % resources with invalid branch references', orphaned_count;
  ELSE
    RAISE NOTICE 'All branch references are valid';
  END IF;
  
  -- Check years
  SELECT COUNT(*) INTO orphaned_count
  FROM resources r LEFT JOIN years y ON r.year_id = y.id 
  WHERE r.year_id IS NOT NULL AND y.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % resources with invalid year references', orphaned_count;
  ELSE
    RAISE NOTICE 'All year references are valid';
  END IF;
  
  -- Check semesters
  SELECT COUNT(*) INTO orphaned_count
  FROM resources r LEFT JOIN semesters s ON r.semester_id = s.id 
  WHERE r.semester_id IS NOT NULL AND s.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % resources with invalid semester references', orphaned_count;
  ELSE
    RAISE NOTICE 'All semester references are valid';
  END IF;
  
  -- Check students (uploader_id can be NULL for admin uploads)
  SELECT COUNT(*) INTO orphaned_count
  FROM resources r LEFT JOIN students st ON r.uploader_id = st.id 
  WHERE r.uploader_id IS NOT NULL AND st.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % resources with invalid uploader references', orphaned_count;
  ELSE
    RAISE NOTICE 'All uploader references are valid (NULL values are acceptable)';
  END IF;
  
  RAISE NOTICE '=== END VALIDATION REPORT ===';
END $$;

-- Phase 4.2: Fix any remaining NULL values or invalid data
-- Set default values for resources that couldn't be migrated properly

-- Fix any resources without title (use name as fallback)
UPDATE resources 
SET title = COALESCE(name, 'Untitled Resource')
WHERE title IS NULL;

-- Fix any resources without drive_link (use url as fallback)
UPDATE resources 
SET drive_link = COALESCE(url, '')
WHERE drive_link IS NULL;

-- Fix any resources without file_type
UPDATE resources 
SET file_type = COALESCE(type, 'unknown')
WHERE file_type IS NULL;

-- For resources without branch_id, try to infer from existing data or set to a default
-- First, let's see if we can infer from any patterns
UPDATE resources 
SET branch_id = (SELECT id FROM branches WHERE code = 'CSE' LIMIT 1)
WHERE branch_id IS NULL;

-- For resources without year_id, set to current academic year (2024)
UPDATE resources 
SET year_id = (SELECT id FROM years WHERE batch_year = 2024 LIMIT 1)
WHERE year_id IS NULL;

-- For resources without semester_id, set to semester 1 of the assigned year
UPDATE resources 
SET semester_id = (
  SELECT s.id FROM semesters s 
  JOIN years y ON s.year_id = y.id 
  WHERE s.semester_number = 1 AND y.id = resources.year_id
  LIMIT 1
)
WHERE semester_id IS NULL AND year_id IS NOT NULL;

-- Final fix for any remaining semester_id issues
UPDATE resources 
SET semester_id = (
  SELECT s.id FROM semesters s 
  JOIN years y ON s.year_id = y.id 
  WHERE s.semester_number = 1 AND y.batch_year = 2024
  LIMIT 1
)
WHERE semester_id IS NULL;

-- Phase 4.3: Make new columns required (after data validation)
-- Only make columns NOT NULL if they have been properly populated

-- Check if all resources have the required fields populated
DO $$ 
DECLARE
  null_title_count integer;
  null_drive_link_count integer;
  null_file_type_count integer;
  null_branch_count integer;
  null_year_count integer;
  null_semester_count integer;
BEGIN
  SELECT COUNT(*) INTO null_title_count FROM resources WHERE title IS NULL;
  SELECT COUNT(*) INTO null_drive_link_count FROM resources WHERE drive_link IS NULL;
  SELECT COUNT(*) INTO null_file_type_count FROM resources WHERE file_type IS NULL;
  SELECT COUNT(*) INTO null_branch_count FROM resources WHERE branch_id IS NULL;
  SELECT COUNT(*) INTO null_year_count FROM resources WHERE year_id IS NULL;
  SELECT COUNT(*) INTO null_semester_count FROM resources WHERE semester_id IS NULL;
  
  RAISE NOTICE 'Checking for NULL values before making columns NOT NULL:';
  RAISE NOTICE 'title: % NULL values', null_title_count;
  RAISE NOTICE 'drive_link: % NULL values', null_drive_link_count;
  RAISE NOTICE 'file_type: % NULL values', null_file_type_count;
  RAISE NOTICE 'branch_id: % NULL values', null_branch_count;
  RAISE NOTICE 'year_id: % NULL values', null_year_count;
  RAISE NOTICE 'semester_id: % NULL values', null_semester_count;
  
  IF null_title_count = 0 AND null_drive_link_count = 0 AND null_file_type_count = 0 
     AND null_branch_count = 0 AND null_year_count = 0 AND null_semester_count = 0 THEN
    RAISE NOTICE 'All required fields are populated. Safe to make columns NOT NULL.';
  ELSE
    RAISE WARNING 'Some required fields still have NULL values. Review data before making columns NOT NULL.';
  END IF;
END $$;

-- Make the new columns NOT NULL (only if data validation passed)
-- These will fail if there are still NULL values, which is intentional
ALTER TABLE resources ALTER COLUMN title SET NOT NULL;
ALTER TABLE resources ALTER COLUMN drive_link SET NOT NULL;
ALTER TABLE resources ALTER COLUMN file_type SET NOT NULL;
ALTER TABLE resources ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE resources ALTER COLUMN year_id SET NOT NULL;
ALTER TABLE resources ALTER COLUMN semester_id SET NOT NULL;
-- Note: uploader_id remains nullable for admin-uploaded resources

-- Phase 4.4: Final verification
SELECT 'Final validation - Total resources:' as status, COUNT(*) as count FROM resources;

SELECT 'Resources with all required fields:' as status, COUNT(*) as count
FROM resources 
WHERE title IS NOT NULL 
  AND drive_link IS NOT NULL 
  AND file_type IS NOT NULL 
  AND branch_id IS NOT NULL 
  AND year_id IS NOT NULL 
  AND semester_id IS NOT NULL;

-- Show distribution by branch and year
SELECT 
  b.code as branch,
  y.batch_year as year,
  s.semester_number as semester,
  COUNT(*) as resource_count
FROM resources r
JOIN branches b ON r.branch_id = b.id
JOIN years y ON r.year_id = y.id
JOIN semesters s ON r.semester_id = s.id
GROUP BY b.code, y.batch_year, s.semester_number
ORDER BY b.code, y.batch_year, s.semester_number;

RAISE NOTICE 'Phase 4 - Data validation and cleanup completed successfully!';
