-- Migration 003: Split Resources Tables
-- Addresses Red Flag #6: Resource Table Overloaded (20+ Fields Spaghetti)
-- Splits into resources + resource_files + resource_metadata tables
-- Preserves drive_link, url, file_type, uploaded_by, uploaded_at, category, subject, unit

BEGIN;

-- Phase 3.1: Create new normalized resource tables

-- Core resource entity (metadata only)
CREATE TABLE IF NOT EXISTS resources_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  subject text NOT NULL,
  unit integer NOT NULL,
  regulation text,
  branch_id uuid REFERENCES branches(id),
  year_id uuid REFERENCES years(id),
  semester_id uuid REFERENCES semesters(id),
  uploader_id uuid NOT NULL REFERENCES users(id),  -- Now references users!
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,  -- Soft delete for auditability
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at trigger for resources_new
DROP TRIGGER IF EXISTS trg_resources_new_updated_at ON resources_new;
CREATE TRIGGER trg_resources_new_updated_at
BEFORE UPDATE ON resources_new
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- File storage (supports multiple files per resource)
CREATE TABLE IF NOT EXISTS resource_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources_new(id) ON DELETE CASCADE,
  file_type text NOT NULL,  -- 'pdf', 'image', 'document'
  file_name text NOT NULL,
  drive_link text,          -- Google Drive link (preserved)
  storage_url text,         -- Supabase Storage URL (preserved)
  file_size_bytes bigint,
  is_primary boolean NOT NULL DEFAULT false,  -- Main file vs attachments
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Resource metadata (extensible key-value for additional attributes)
CREATE TABLE IF NOT EXISTS resource_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources_new(id) ON DELETE CASCADE,
  meta_key text NOT NULL,
  meta_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (resource_id, meta_key)
);

-- Phase 3.2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_resources_new_uploader ON resources_new(uploader_id);
CREATE INDEX IF NOT EXISTS idx_resources_new_category ON resources_new(category);
CREATE INDEX IF NOT EXISTS idx_resources_new_subject ON resources_new(subject);
CREATE INDEX IF NOT EXISTS idx_resources_new_unit ON resources_new(unit);
CREATE INDEX IF NOT EXISTS idx_resources_new_branch_year ON resources_new(branch_id, year_id);
CREATE INDEX IF NOT EXISTS idx_resources_new_semester ON resources_new(semester_id);
CREATE INDEX IF NOT EXISTS idx_resources_new_uploaded_at ON resources_new(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_new_deleted_at ON resources_new(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resource_files_resource ON resource_files(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_files_type ON resource_files(file_type);
CREATE INDEX IF NOT EXISTS idx_resource_files_primary ON resource_files(is_primary) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_resource_metadata_resource ON resource_metadata(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_metadata_key ON resource_metadata(meta_key);

-- Phase 3.3: Migrate existing data from resources to new structure

-- Step 1: Migrate core resource data
INSERT INTO resources_new (
  title, description, category, subject, unit, regulation,
  branch_id, year_id, semester_id, uploader_id, uploaded_at,
  deleted_at, created_at, updated_at
)
SELECT
  COALESCE(r.name, 'Untitled Resource') as title,
  r.description,
  r.category,
  r.subject,
  r.unit,
  r.regulation,
  b.id as branch_id,
  y.id as year_id,
  s.id as semester_id,
  CASE
    WHEN r.created_by IS NOT NULL THEN (
      SELECT u.id FROM users u WHERE u.email = (
        COALESCE(
          (SELECT p.email FROM profiles p WHERE p.id = r.created_by),
          (SELECT a.email FROM admins a WHERE a.id = r.created_by)
        )
      ) LIMIT 1
    )
    ELSE NULL
  END as uploader_id,
  COALESCE(r.date, r.created_at) as uploaded_at,
  r.deleted_at,
  r.created_at,
  r.updated_at
FROM resources r
LEFT JOIN branches b ON b.code = r.branch::text
LEFT JOIN years y ON y.batch_year = (
  CASE
    WHEN r.year IS NOT NULL THEN
      EXTRACT(YEAR FROM current_date) - (r.year - 1)
    ELSE NULL
  END
)
LEFT JOIN semesters s ON s.year_id = y.id AND s.semester_number = COALESCE(r.semester, 1);

-- Step 2: Migrate file data (handle both drive_link and url)
INSERT INTO resource_files (resource_id, file_type, file_name, drive_link, storage_url, is_primary)
SELECT
  rn.id as resource_id,
  COALESCE(r.type, 'document') as file_type,
  COALESCE(r.name || CASE WHEN r.is_pdf THEN '.pdf' ELSE '' END, 'resource_file') as file_name,
  r.drive_link,  -- Preserve drive_link
  r.url,         -- Preserve url as storage_url
  true as is_primary  -- All existing resources are primary files
FROM resources r
JOIN resources_new rn ON rn.title = COALESCE(r.name, 'Untitled Resource')
  AND rn.category = r.category
  AND rn.subject = r.subject
  AND rn.unit = r.unit
  AND rn.uploaded_at = COALESCE(r.date, r.created_at);

-- Step 3: Migrate additional metadata (archived status, etc.)
INSERT INTO resource_metadata (resource_id, meta_key, meta_value)
SELECT
  rn.id as resource_id,
  'archived' as meta_key,
  to_jsonb(r.archived) as meta_value
FROM resources r
JOIN resources_new rn ON rn.title = COALESCE(r.name, 'Untitled Resource')
  AND rn.category = r.category
  AND rn.subject = r.subject
  AND rn.unit = r.unit
WHERE r.archived IS NOT NULL;

-- Phase 3.4: Create view for backwards compatibility during transition
CREATE OR REPLACE VIEW resources_view AS
SELECT
  r.id,
  r.title as name,  -- Map title to name for compatibility
  r.description,
  r.category,
  r.subject,
  r.unit,
  r.regulation,
  b.code as branch,  -- Keep enum-like branch code for compatibility
  y.batch_year as year,  -- Keep raw year for compatibility
  s.semester_number as semester,  -- Keep raw semester for compatibility
  rf.drive_link,
  rf.storage_url as url,
  CASE WHEN rf.file_type = 'pdf' THEN true ELSE false END as is_pdf,
  rf.file_type as type,
  r.uploaded_at as date,
  r.created_at,
  r.updated_at,
  r.deleted_at,
  u.email as uploader_email,  -- For compatibility
  r.uploader_id as created_by
FROM resources_new r
LEFT JOIN branches b ON r.branch_id = b.id
LEFT JOIN years y ON r.year_id = y.id
LEFT JOIN semesters s ON r.semester_id = s.id
LEFT JOIN resource_files rf ON r.id = rf.resource_id AND rf.is_primary = true
LEFT JOIN users u ON r.uploader_id = u.id
WHERE r.deleted_at IS NULL;  -- Hide soft-deleted resources

-- Phase 3.5: Create helper functions for resource management

-- Function to get primary file for a resource
CREATE OR REPLACE FUNCTION get_resource_primary_file(resource_uuid uuid)
RETURNS TABLE (
  file_type text,
  file_name text,
  drive_link text,
  storage_url text,
  file_size_bytes bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rf.file_type,
    rf.file_name,
    rf.drive_link,
    rf.storage_url,
    rf.file_size_bytes
  FROM resource_files rf
  WHERE rf.resource_id = resource_uuid
  AND rf.is_primary = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to add metadata to resource
CREATE OR REPLACE FUNCTION add_resource_metadata(
  resource_uuid uuid,
  key_name text,
  value_data jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO resource_metadata (resource_id, meta_key, meta_value)
  VALUES (resource_uuid, key_name, value_data)
  ON CONFLICT (resource_id, meta_key) DO UPDATE SET
    meta_value = EXCLUDED.meta_value;
END;
$$ LANGUAGE plpgsql;

-- Phase 3.6: Verification queries
SELECT '=== MIGRATION 003 VERIFICATION ===' as section;
SELECT 'Original resources:' as check, COUNT(*) as count FROM resources;
SELECT 'New resources created:' as check, COUNT(*) as count FROM resources_new;
SELECT 'Resource files created:' as check, COUNT(*) as count FROM resource_files;
SELECT 'Resource metadata entries:' as check, COUNT(*) as count FROM resource_metadata;

-- Check data integrity
SELECT 'Resources without files:' as check, COUNT(*) as count
FROM resources_new r
LEFT JOIN resource_files rf ON r.id = rf.resource_id
WHERE rf.id IS NULL;

SELECT 'Resources without uploader:' as check, COUNT(*) as count
FROM resources_new r
WHERE r.uploader_id IS NULL;

-- Sample migrated data
SELECT 'Sample migrated resources:' as check;
SELECT
  r.title,
  r.category,
  r.subject,
  r.unit,
  b.code as branch,
  y.batch_year as year,
  s.semester_number as semester,
  rf.file_type,
  CASE WHEN rf.drive_link IS NOT NULL THEN 'Has Drive Link' ELSE 'No Drive Link' END as drive_status,
  CASE WHEN rf.storage_url IS NOT NULL THEN 'Has Storage URL' ELSE 'No Storage URL' END as storage_status
FROM resources_new r
LEFT JOIN branches b ON r.branch_id = b.id
LEFT JOIN years y ON r.year_id = y.id
LEFT JOIN semesters s ON r.semester_id = s.id
LEFT JOIN resource_files rf ON r.id = rf.resource_id AND rf.is_primary = true
LIMIT 10;

COMMIT;

-- Post-migration notes:
-- 1. Update application code to use resources_new table and related functions
-- 2. Use resources_view for gradual migration of existing queries
-- 3. Consider renaming resources_new to resources after full migration
-- 4. Update RLS policies to work with new table structure
-- 5. Keep original resources table as backup until verification complete
