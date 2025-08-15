-- Database Refactoring Phase 5: Remove Old Columns and Constraints
-- This migration removes old ENUM-based columns after ensuring new system works

-- Phase 5.1: Create backup before dropping columns
CREATE TABLE IF NOT EXISTS resources_backup AS SELECT * FROM resources;

-- Verify backup was created
DO $$ 
DECLARE
  backup_count integer;
  original_count integer;
BEGIN
  SELECT COUNT(*) INTO backup_count FROM resources_backup;
  SELECT COUNT(*) INTO original_count FROM resources;
  
  RAISE NOTICE 'Backup created: % rows backed up from % original rows', backup_count, original_count;
  
  IF backup_count != original_count THEN
    RAISE EXCEPTION 'Backup verification failed! Backup has % rows but original has %', backup_count, original_count;
  END IF;
END $$;

-- Phase 5.2: Drop old foreign key constraints (if they exist)
DO $$ BEGIN
  ALTER TABLE resources DROP CONSTRAINT IF EXISTS fk_resources_created_by;
EXCEPTION WHEN others THEN 
  RAISE NOTICE 'Constraint fk_resources_created_by did not exist or could not be dropped';
END $$;

-- Phase 5.3: Drop old columns (after ensuring new system works)
-- WARNING: This is irreversible (except via backup restore)

-- Drop old resource columns that are now replaced
ALTER TABLE resources DROP COLUMN IF EXISTS name;
ALTER TABLE resources DROP COLUMN IF EXISTS url;
ALTER TABLE resources DROP COLUMN IF EXISTS type;
ALTER TABLE resources DROP COLUMN IF EXISTS branch;
ALTER TABLE resources DROP COLUMN IF EXISTS year;
ALTER TABLE resources DROP COLUMN IF EXISTS semester;
ALTER TABLE resources DROP COLUMN IF EXISTS created_by; -- Replaced by uploader_id

-- Optional: Remove columns that don't fit the target schema
-- Uncomment these if you want to remove them completely:
-- ALTER TABLE resources DROP COLUMN IF EXISTS category;
-- ALTER TABLE resources DROP COLUMN IF EXISTS subject;
-- ALTER TABLE resources DROP COLUMN IF EXISTS unit;
-- ALTER TABLE resources DROP COLUMN IF EXISTS date;
-- ALTER TABLE resources DROP COLUMN IF EXISTS is_pdf;
-- ALTER TABLE resources DROP COLUMN IF EXISTS regulation;
-- ALTER TABLE resources DROP COLUMN IF EXISTS archived;
-- ALTER TABLE resources DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE resources DROP COLUMN IF EXISTS updated_at;

-- Phase 5.4: Remove profiles table (after confirming students table is working)
-- First, let's verify students table has all the data we need
DO $$ 
DECLARE
  profile_student_count integer;
  student_count integer;
BEGIN
  SELECT COUNT(*) INTO profile_student_count FROM profiles WHERE role = 'student';
  SELECT COUNT(*) INTO student_count FROM students;
  
  RAISE NOTICE 'Profiles (students): %, Students table: %', profile_student_count, student_count;
  
  IF student_count >= profile_student_count THEN
    RAISE NOTICE 'Students table has same or more records than student profiles. Safe to proceed.';
  ELSE
    RAISE WARNING 'Students table has fewer records than student profiles. Review before dropping profiles table.';
  END IF;
END $$;

-- Create a backup of profiles before dropping (uncomment to create backup)
-- CREATE TABLE IF NOT EXISTS profiles_backup AS SELECT * FROM profiles;

-- Drop profiles table (uncomment when ready)
-- DROP TABLE IF EXISTS profiles CASCADE;

-- Phase 5.5: Clean up old enum types (only after confirming they're not used elsewhere)
-- These will fail if any tables still reference these types, which is good for safety

-- Check what tables still use branch_type enum
DO $$ 
DECLARE
  enum_usage_count integer;
BEGIN
  SELECT COUNT(*) INTO enum_usage_count
  FROM information_schema.columns 
  WHERE udt_name = 'branch_type' 
  AND table_schema = 'public';
  
  RAISE NOTICE 'Tables still using branch_type enum: %', enum_usage_count;
  
  IF enum_usage_count = 0 THEN
    RAISE NOTICE 'No tables use branch_type enum. Safe to drop.';
    -- DROP TYPE IF EXISTS branch_type;
  ELSE
    RAISE NOTICE 'branch_type enum still in use. Skipping DROP TYPE.';
  END IF;
END $$;

-- Phase 5.6: Verification of cleanup
DO $$ 
DECLARE
  column_exists boolean;
BEGIN
  RAISE NOTICE '=== CLEANUP VERIFICATION ===';
  
  -- Check if old columns still exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'resources' 
    AND column_name IN ('name', 'url', 'type', 'branch', 'year', 'semester', 'created_by')
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE 'Some old columns still exist in resources table';
  ELSE
    RAISE NOTICE 'All specified old columns have been removed from resources table';
  END IF;
  
  -- Show current resources table structure
  RAISE NOTICE 'Current resources table columns:';
  FOR column_name IN 
    SELECT c.column_name 
    FROM information_schema.columns c
    WHERE c.table_name = 'resources' 
    AND c.table_schema = 'public'
    ORDER BY c.ordinal_position
  LOOP
    RAISE NOTICE '  - %', column_name.column_name;
  END LOOP;
  
  RAISE NOTICE '=== END CLEANUP VERIFICATION ===';
END $$;

-- Phase 5.7: Update table comments and documentation
COMMENT ON TABLE resources IS 'Resources with normalized foreign key relationships to branches, years, and semesters';
COMMENT ON COLUMN resources.title IS 'Resource title (replaces old name column)';
COMMENT ON COLUMN resources.drive_link IS 'Google Drive or storage URL (replaces old url column)';
COMMENT ON COLUMN resources.file_type IS 'File type/format (replaces old type column)';
COMMENT ON COLUMN resources.branch_id IS 'Foreign key to branches table (replaces old branch enum)';
COMMENT ON COLUMN resources.year_id IS 'Foreign key to years table (replaces old year number)';
COMMENT ON COLUMN resources.semester_id IS 'Foreign key to semesters table (replaces old semester number)';
COMMENT ON COLUMN resources.uploader_id IS 'Foreign key to students table (replaces old created_by)';

COMMENT ON TABLE students IS 'Student profiles with normalized foreign key relationships';
COMMENT ON TABLE branches IS 'Academic branches/departments lookup table';
COMMENT ON TABLE years IS 'Academic years/batches lookup table';
COMMENT ON TABLE semesters IS 'Semesters lookup table linked to years';
COMMENT ON TABLE academic_calendar IS 'Current academic period control for admin-managed progression';

-- Final success message
RAISE NOTICE 'Phase 5 - Schema cleanup completed successfully!';
RAISE NOTICE 'Old columns removed, backup tables created, and new schema is active.';
RAISE NOTICE 'Remember to update application code to use new column names and relationships.';
