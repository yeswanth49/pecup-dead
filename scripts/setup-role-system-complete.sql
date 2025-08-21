-- Complete Role System Setup
-- Run this script to set up the entire role-based permission system

-- ============================================================================
-- STEP 1: Create the user_role enum
-- ============================================================================

-- Create user_role enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'representative', 'admin', 'superadmin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- If enum exists but missing values, add them
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'representative';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: Add role column to profiles table
-- ============================================================================

-- Add role column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'student';

-- ============================================================================
-- STEP 3: Create representatives table
-- ============================================================================

-- Create representatives table to track representative assignments
CREATE TABLE IF NOT EXISTS representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, branch_id, year_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_representatives_user ON representatives(user_id);
CREATE INDEX IF NOT EXISTS idx_representatives_branch_year ON representatives(branch_id, year_id);
CREATE INDEX IF NOT EXISTS idx_representatives_active ON representatives(active);

-- ============================================================================
-- STEP 4: Create semester promotions table
-- ============================================================================

-- Add semester promotion tracking table
CREATE TABLE IF NOT EXISTS semester_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promoted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  promotion_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for semester promotion tracking
CREATE INDEX IF NOT EXISTS idx_semester_promotions_promoted_by ON semester_promotions(promoted_by);
CREATE INDEX IF NOT EXISTS idx_semester_promotions_date ON semester_promotions(promotion_date);

-- ============================================================================
-- STEP 5: Verify setup
-- ============================================================================

-- Check that everything was created correctly
SELECT 'user_role enum values:' as info;
SELECT enumlabel as role_values FROM pg_enum e 
JOIN pg_type t ON e.enumtypid = t.oid 
WHERE t.typname = 'user_role' 
ORDER BY e.enumsortorder;

SELECT 'profiles table columns:' as info;
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

SELECT 'representatives table exists:' as info;
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'representatives' AND table_schema = 'public'
) as table_exists;

SELECT 'semester_promotions table exists:' as info;
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'semester_promotions' AND table_schema = 'public'
) as table_exists;

-- ============================================================================
-- READY TO USE!
-- ============================================================================
/*
After running this script, you can use the role assignment examples in:
- scripts/role-management-examples.sql

The system will support:
- student: Default role, read-only access
- representative: Can manage resources for assigned branch/year
- admin: Can manage all resources  
- superadmin: Full system access

Your years table structure (admission years):
- 2021: 4th year students
- 2022: 3rd year students  
- 2023: 2nd year students
- 2024: 1st year students
*/
