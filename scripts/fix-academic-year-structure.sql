-- Fix Academic Year Structure
-- This script properly sets up the academic year system

-- ============================================================================
-- APPROACH 1: Use admission year + current academic year
-- ============================================================================

-- Update years table to represent admission year (when batch joined)
-- For example: 2024 batch will study from 2024-2028

-- Clear existing data and recreate with proper structure
DELETE FROM years;

-- Insert admission years (when each batch joined)
INSERT INTO years (id, batch_year, display_name, created_at) VALUES
('7b8b9656-2bf1-42b7-b63c-8fad4af1a405', 2021, '2021 Admission Batch', now()),
('0df1a38a-2ccf-4613-9adf-7c879e75e494', 2022, '2022 Admission Batch', now()),
('57283f9b-01a2-4789-b0c0-ed7981c67fe1', 2023, '2023 Admission Batch', now()),
('d60b0ffd-5de7-4103-b40a-65589fabcef4', 2024, '2024 Admission Batch', now());

-- Add a new table to track current academic year for each batch
CREATE TABLE IF NOT EXISTS academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  current_academic_year integer NOT NULL CHECK (current_academic_year BETWEEN 1 AND 4),
  academic_session text NOT NULL, -- e.g., "2024-25", "2025-26"
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert academic years for each batch
-- 2021 batch (now in 4th year - 2024-25 session)
INSERT INTO academic_years (admission_year_id, current_academic_year, academic_session, is_current)
SELECT id, 4, '2024-25', true FROM years WHERE batch_year = 2021;

-- 2022 batch (now in 3rd year - 2024-25 session)  
INSERT INTO academic_years (admission_year_id, current_academic_year, academic_session, is_current)
SELECT id, 3, '2024-25', true FROM years WHERE batch_year = 2022;

-- 2023 batch (now in 2nd year - 2024-25 session)
INSERT INTO academic_years (admission_year_id, current_academic_year, academic_session, is_current)
SELECT id, 2, '2024-25', true FROM years WHERE batch_year = 2023;

-- 2024 batch (now in 1st year - 2024-25 session)
INSERT INTO academic_years (admission_year_id, current_academic_year, academic_session, is_current)
SELECT id, 1, '2024-25', true FROM years WHERE batch_year = 2024;

-- ============================================================================
-- APPROACH 2: Simpler - Add current_year field to profiles
-- ============================================================================

-- Alternative: Just add current academic year to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_academic_year integer CHECK (current_academic_year BETWEEN 1 AND 4);

-- Update existing profiles based on their admission year
-- Assuming current session is 2024-25:

-- 2021 batch -> 4th year (2021+3 = 2024, so 4th year in 2024-25)
UPDATE profiles SET current_academic_year = 4 WHERE year = 2021;

-- 2022 batch -> 3rd year  
UPDATE profiles SET current_academic_year = 3 WHERE year = 2022;

-- 2023 batch -> 2nd year
UPDATE profiles SET current_academic_year = 2 WHERE year = 2023;

-- 2024 batch -> 1st year
UPDATE profiles SET current_academic_year = 1 WHERE year = 2024;

-- ============================================================================
-- UPDATED ROLE ASSIGNMENT SCRIPT
-- ============================================================================

-- Now when assigning representatives, you can specify by admission year and current academic year
-- Example: Assign representative for 2023 admission batch (currently in 2nd year)

DO $$
DECLARE
    user_email TEXT := 'sinchan123v@gmail.com';  -- User to assign
    branch_code TEXT := 'CSE';                   -- Branch
    admission_year INT := 2023;                  -- When this batch was admitted  
    target_academic_year INT := 2;               -- Which year they're currently in (1st, 2nd, 3rd, 4th)
    user_uuid UUID;
    branch_uuid UUID;
    year_uuid UUID;
BEGIN
    -- Get user ID
    SELECT id INTO user_uuid 
    FROM profiles 
    WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User not found: %', user_email;
    END IF;
    
    -- Get branch ID
    SELECT id INTO branch_uuid 
    FROM branches 
    WHERE code = branch_code;
    
    IF branch_uuid IS NULL THEN
        RAISE EXCEPTION 'Branch not found: %', branch_code;
    END IF;
    
    -- Get year ID (admission year)
    SELECT id INTO year_uuid 
    FROM years 
    WHERE years.batch_year = admission_year;
    
    IF year_uuid IS NULL THEN
        RAISE EXCEPTION 'Admission year not found: %', admission_year;
    END IF;
    
    -- Update profile role
    UPDATE profiles 
    SET role = 'representative' 
    WHERE id = user_uuid;
    
    -- Create representative assignment
    INSERT INTO representatives (user_id, branch_id, year_id, active)
    VALUES (user_uuid, branch_uuid, year_uuid, true)
    ON CONFLICT (user_id, branch_id, year_id) 
    DO UPDATE SET active = true;
    
    RAISE NOTICE 'Assigned % as representative for % % admission batch (currently %year)', 
                 user_email, branch_code, admission_year, target_academic_year;
END $$;

-- ============================================================================
-- HELPER QUERIES
-- ============================================================================

-- View students by admission year and current academic year
SELECT 
    p.email,
    p.name,
    p.role,
    p.year as admission_year,
    p.current_academic_year,
    b.code as branch,
    CASE 
        WHEN p.current_academic_year = 1 THEN '1st Year'
        WHEN p.current_academic_year = 2 THEN '2nd Year' 
        WHEN p.current_academic_year = 3 THEN '3rd Year'
        WHEN p.current_academic_year = 4 THEN '4th Year'
        ELSE 'Unknown'
    END as year_display
FROM profiles p
JOIN branches b ON p.branch::text = b.code
ORDER BY p.current_academic_year, admission_year, branch;

-- View representatives with clearer year information
SELECT 
    p.email,
    p.name,
    b.code as branch,
    y.batch_year as admission_year,
    p.current_academic_year,
    CASE 
        WHEN p.current_academic_year = 1 THEN '1st Year'
        WHEN p.current_academic_year = 2 THEN '2nd Year'
        WHEN p.current_academic_year = 3 THEN '3rd Year' 
        WHEN p.current_academic_year = 4 THEN '4th Year'
        ELSE 'Unknown'
    END as current_year_display,
    r.active,
    r.assigned_at
FROM representatives r
JOIN profiles p ON r.user_id = p.id
JOIN branches b ON r.branch_id = b.id
JOIN years y ON r.year_id = y.id
ORDER BY b.code, y.batch_year, p.current_academic_year;

-- Function to promote entire batches to next year
CREATE OR REPLACE FUNCTION promote_academic_year(
    target_admission_year INT,
    from_academic_year INT,
    to_academic_year INT
) RETURNS void AS $$
BEGIN
    -- Validate years
    IF from_academic_year < 1 OR from_academic_year > 4 OR 
       to_academic_year < 1 OR to_academic_year > 4 OR
       to_academic_year != from_academic_year + 1 THEN
        RAISE EXCEPTION 'Invalid academic year progression: % to %', from_academic_year, to_academic_year;
    END IF;
    
    -- Update all students from that admission year
    UPDATE profiles 
    SET current_academic_year = to_academic_year
    WHERE year = target_admission_year 
    AND current_academic_year = from_academic_year;
    
    -- Log the promotion
    INSERT INTO semester_promotions (promoted_by, branch_id, year_id, notes)
    SELECT 
        (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin') LIMIT 1),
        b.id,
        y.id,
        format('Promoted %s admission batch from %s year to %s year', 
               target_admission_year, from_academic_year, to_academic_year)
    FROM branches b, years y 
    WHERE y.batch_year = target_admission_year;
    
    RAISE NOTICE 'Promoted % admission batch from %year to %year', 
                 target_admission_year, from_academic_year, to_academic_year;
END;
$$ LANGUAGE plpgsql;

-- Example: Promote 2023 admission batch from 2nd year to 3rd year
-- SELECT promote_academic_year(2023, 2, 3);

-- ============================================================================
-- RECOMMENDED USAGE
-- ============================================================================

/*
With this structure:

1. years.batch_year = admission year (2021, 2022, 2023, 2024)
2. profiles.current_academic_year = current year of study (1, 2, 3, 4)

Examples:
- 2023 admission batch, currently in 2nd year
- 2024 admission batch, currently in 1st year  
- 2022 admission batch, currently in 3rd year

When assigning representatives:
- Choose admission year (which batch)
- Representative manages that batch regardless of their current academic year
- Resources are organized by admission year + current academic year

This makes it clear and avoids confusion!
*/
