-- Fix Branch Naming Consistency
-- This script updates the subject_offerings table to use short branch codes
-- that match the codebase conventions and branches table

BEGIN;

-- Update CSE(AIML) to AIML
UPDATE subject_offerings 
SET branch = 'AIML'
WHERE branch = 'CSE(AIML)';

-- Update CSE(DS) to DS  
UPDATE subject_offerings 
SET branch = 'DS'
WHERE branch = 'CSE(DS)';

-- Verify the changes
SELECT 
    'After Update' as status,
    branch,
    COUNT(*) as count
FROM subject_offerings 
WHERE branch IN ('AIML', 'DS', 'CSE(AIML)', 'CSE(DS)')
GROUP BY branch
ORDER BY branch;

-- Show all distinct branches after update
SELECT 'All branches after update:' as info;
SELECT DISTINCT branch FROM subject_offerings ORDER BY branch;

COMMIT;
