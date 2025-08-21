-- Convert ALL tables from academic years (1,2,3,4) to admission years (2024,2023,2022,2021)
-- Based on current academic session 2024-25

-- Current mapping (assuming current session is 2024-25):
-- Academic Year 1 (1st year) -> 2024 admission batch
-- Academic Year 2 (2nd year) -> 2023 admission batch  
-- Academic Year 3 (3rd year) -> 2022 admission batch
-- Academic Year 4 (4th year) -> 2021 admission batch

-- Update resources table
UPDATE resources 
SET year = CASE 
    WHEN year = 1 THEN 2024  -- 1st year students admitted in 2024
    WHEN year = 2 THEN 2023  -- 2nd year students admitted in 2023
    WHEN year = 3 THEN 2022  -- 3rd year students admitted in 2022
    WHEN year = 4 THEN 2021  -- 4th year students admitted in 2021
    ELSE year  -- Keep other values unchanged
END
WHERE year IN (1, 2, 3, 4);

-- Update recent_updates table
UPDATE recent_updates 
SET year = CASE 
    WHEN year = 1 THEN 2024  -- 1st year students admitted in 2024
    WHEN year = 2 THEN 2023  -- 2nd year students admitted in 2023
    WHEN year = 3 THEN 2022  -- 3rd year students admitted in 2022
    WHEN year = 4 THEN 2021  -- 4th year students admitted in 2021
    ELSE year  -- Keep other values unchanged
END
WHERE year IN (1, 2, 3, 4);

-- Update reminders table
UPDATE reminders 
SET year = CASE 
    WHEN year = 1 THEN 2024  -- 1st year students admitted in 2024
    WHEN year = 2 THEN 2023  -- 2nd year students admitted in 2023
    WHEN year = 3 THEN 2022  -- 3rd year students admitted in 2022
    WHEN year = 4 THEN 2021  -- 4th year students admitted in 2021
    ELSE year  -- Keep other values unchanged
END
WHERE year IN (1, 2, 3, 4);

-- Update exams table
UPDATE exams 
SET year = CASE 
    WHEN year = 1 THEN 2024  -- 1st year students admitted in 2024
    WHEN year = 2 THEN 2023  -- 2nd year students admitted in 2023
    WHEN year = 3 THEN 2022  -- 3rd year students admitted in 2022
    WHEN year = 4 THEN 2021  -- 4th year students admitted in 2021
    ELSE year  -- Keep other values unchanged
END
WHERE year IN (1, 2, 3, 4);

-- Update profiles table (IMPORTANT: This fixes the home page issue!)
-- First, drop the constraint that limits year to 1-4
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_year_check;

-- Update the year values BEFORE adding the new constraint
UPDATE profiles 
SET year = CASE 
    WHEN year = 1 THEN 2024  -- 1st year students admitted in 2024
    WHEN year = 2 THEN 2023  -- 2nd year students admitted in 2023
    WHEN year = 3 THEN 2022  -- 3rd year students admitted in 2022
    WHEN year = 4 THEN 2021  -- 4th year students admitted in 2021
    ELSE year  -- Keep other values unchanged
END
WHERE year IN (1, 2, 3, 4);

-- Now add new constraint for admission years (2020-2030 range to be future-proof)
ALTER TABLE profiles ADD CONSTRAINT profiles_year_check CHECK (year >= 2020 AND year <= 2030);

-- Check the results for all tables
SELECT 'Resources' as table_name, year as admission_year, COUNT(*) as count
FROM resources 
WHERE year IS NOT NULL
GROUP BY year 
UNION ALL
SELECT 'Recent Updates' as table_name, year as admission_year, COUNT(*) as count
FROM recent_updates 
WHERE year IS NOT NULL
GROUP BY year 
UNION ALL
SELECT 'Reminders' as table_name, year as admission_year, COUNT(*) as count
FROM reminders 
WHERE year IS NOT NULL
GROUP BY year 
UNION ALL
SELECT 'Exams' as table_name, year as admission_year, COUNT(*) as count
FROM exams 
WHERE year IS NOT NULL
GROUP BY year 
UNION ALL
SELECT 'Profiles' as table_name, year as admission_year, COUNT(*) as count
FROM profiles 
WHERE year IS NOT NULL
GROUP BY year 
ORDER BY table_name, admission_year DESC;

-- Sample results after conversion
SELECT 'resources' as table_name, id, name, year as admission_year, branch, category 
FROM resources 
WHERE branch = 'CSE' AND year IS NOT NULL
LIMIT 3;

SELECT 'recent_updates' as table_name, id, title as name, year as admission_year, branch, 'update' as category
FROM recent_updates 
WHERE branch = 'CSE' AND year IS NOT NULL
LIMIT 3;
