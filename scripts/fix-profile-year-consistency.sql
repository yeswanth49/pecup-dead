-- Fix Profile and Representative Assignment Consistency
-- This ensures users see exactly their branch and year content

-- Update your profile to match your representative assignment
-- You're assigned to manage CSE 2024 batch, so your profile should be 2024
UPDATE profiles 
SET year = 2024 
WHERE email = 'sinchan123v@gmail.com';

-- Verify the fix
SELECT 
    'Profile Data' as info,
    p.email,
    p.year::text as profile_year,
    p.branch::text as profile_branch,
    p.role::text
FROM profiles p 
WHERE p.email = 'sinchan123v@gmail.com'

UNION ALL

SELECT 
    'Representative Assignment' as info,
    p.email,
    y.batch_year::text as assigned_year,
    b.code::text as assigned_branch,
    'representative' as role
FROM representatives r
JOIN profiles p ON r.user_id = p.id  
JOIN branches b ON r.branch_id = b.id
JOIN years y ON r.year_id = y.id
WHERE p.email = 'sinchan123v@gmail.com'
ORDER BY info;

-- Check what recent updates you should see after this fix
SELECT 
    title,
    date,
    year,
    branch,
    'Should be visible' as visibility
FROM recent_updates 
WHERE year = 2024 AND branch = 'CSE'
ORDER BY created_at DESC;
