-- Remove hardcoded sample recent updates that appear for all branches and years
-- These are sample/test entries that should not be shown to users

-- First, let's see what we're about to delete
SELECT 'ENTRIES TO BE DELETED:' as action;
SELECT id, title, year, branch, created_at 
FROM recent_updates 
WHERE year IS NULL AND branch IS NULL 
ORDER BY created_at;

-- Delete the specific hardcoded entries by ID
DELETE FROM recent_updates WHERE id = '1c837c40-5e6a-4cec-bc36-d021c6e85e7b'; -- SE Unit 1,2,3 Key Points File
DELETE FROM recent_updates WHERE id = '4e313cde-a302-4d65-9e90-4c33b240cf34'; -- DBMS Model Paper
DELETE FROM recent_updates WHERE id = 'cc13d4b2-8d3c-4822-bcd6-7afa19b20748'; -- DBMS Mid 2 Paper
DELETE FROM recent_updates WHERE id = 'd22b2208-285f-41c1-b3ac-d1d8ed9b093a'; -- DBMS Notes Error Adjusted
DELETE FROM recent_updates WHERE id = 'de8084ab-b699-4ca9-8f01-5fe6cf1202dc'; -- DBMS Unit 5 Notes

-- Alternative: Delete all entries with NULL year and branch (same result)
-- DELETE FROM recent_updates WHERE year IS NULL AND branch IS NULL;

-- Verify deletion
SELECT 'REMAINING ENTRIES:' as action;
SELECT COUNT(*) as remaining_count
FROM recent_updates;

SELECT id, title, year, branch, created_at 
FROM recent_updates 
ORDER BY created_at DESC;

SELECT 'DELETION COMPLETE - Hardcoded entries removed' as status;
