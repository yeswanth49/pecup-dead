-- Add resource_type column to subjects table
-- This script adds a resource_type column to distinguish between:
-- 'resources' - normal subjects that store notes, assignments, papers
-- 'records' - lab/laboratory subjects that store weekly records

-- Add resource_type enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM ('resources', 'records');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add resource_type column to subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS resource_type resource_type NOT NULL DEFAULT 'resources';

-- Add full_name column to subjects table if it doesn't exist (from curriculum script)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS full_name text;

-- Create index for resource_type for better query performance
CREATE INDEX IF NOT EXISTS idx_subjects_resource_type ON subjects(resource_type);

-- Update existing subjects with resource_type based on their names
-- All subjects containing 'Lab', 'Laboratory', 'Workshop', or 'NSS/NCC' are 'records'
UPDATE subjects 
SET resource_type = 'records' 
WHERE (
  name ILIKE '%lab%' OR 
  name ILIKE '%laboratory%' OR 
  name ILIKE '%workshop%' OR 
  code = 'NSSNCC'
) AND resource_type = 'resources';

-- Verification query (uncomment to run)
-- SELECT code, name, resource_type FROM subjects ORDER BY resource_type, code;
