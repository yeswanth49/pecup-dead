-- Add role column to profiles table
-- Run this first before using the role assignment scripts

-- Step 1: Add the role column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'student';

-- Step 2: Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role';

-- Step 3: Check current profiles
SELECT id, email, name, role FROM profiles LIMIT 5;
