-- Test Resource Type Filtering
-- This script demonstrates the resource_type filtering functionality

-- Show all subjects grouped by resource_type
SELECT 
  resource_type,
  COUNT(*) as subject_count,
  string_agg(code, ', ' ORDER BY code) as subject_codes
FROM subjects 
GROUP BY resource_type
ORDER BY resource_type;

-- Show lab/laboratory subjects (for Records category)
SELECT code, name, resource_type
FROM subjects 
WHERE resource_type = 'records'
ORDER BY code;

-- Show theory subjects (for Notes, Assignments, Papers categories)
SELECT code, name, resource_type
FROM subjects 
WHERE resource_type = 'resources'
ORDER BY code;

-- Test subject offerings query with resource_type filtering
-- Example: Get CSE(DS) 2nd year 1st semester lab subjects only
SELECT 
  so.regulation,
  so.branch,
  so.year,
  so.semester,
  s.code,
  s.name,
  s.resource_type,
  so.display_order
FROM subject_offerings so
JOIN subjects s ON so.subject_id = s.id
WHERE so.regulation = 'R23'
  AND so.branch = 'CSE(DS)'
  AND so.year = 2
  AND so.semester = 1
  AND s.resource_type = 'records'
  AND so.active = true
ORDER BY so.display_order;

-- Test subject offerings query for theory subjects
-- Example: Get CSE(DS) 2nd year 1st semester theory subjects only
SELECT 
  so.regulation,
  so.branch,
  so.year,
  so.semester,
  s.code,
  s.name,
  s.resource_type,
  so.display_order
FROM subject_offerings so
JOIN subjects s ON so.subject_id = s.id
WHERE so.regulation = 'R23'
  AND so.branch = 'CSE(DS)'
  AND so.year = 2
  AND so.semester = 1
  AND s.resource_type = 'resources'
  AND so.active = true
ORDER BY so.display_order;
