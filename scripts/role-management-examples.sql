-- Role Management Examples
-- Use these SQL commands to assign roles directly in the database

-- ============================================================================
-- ASSIGN SUPERADMIN ROLE
-- ============================================================================

-- Example: Make user@example.com a superadmin
DO $$
DECLARE
    user_email TEXT := 'user@example.com';  -- CHANGE THIS EMAIL
BEGIN
    -- Update profile role
    UPDATE profiles 
    SET role = 'superadmin' 
    WHERE email = user_email;
    
    -- Add to admins table
    INSERT INTO admins (email, role)
    VALUES (user_email, 'superadmin')
    ON CONFLICT (email) DO UPDATE SET role = 'superadmin';
    
    RAISE NOTICE 'Assigned superadmin role to %', user_email;
END $$;

-- ============================================================================
-- ASSIGN ADMIN ROLE  
-- ============================================================================

-- Example: Make user@example.com an admin
DO $$
DECLARE
    user_email TEXT := 'admin@example.com';  -- CHANGE THIS EMAIL
BEGIN
    -- Update profile role
    UPDATE profiles 
    SET role = 'admin' 
    WHERE email = user_email;
    
    -- Add to admins table
    INSERT INTO admins (email, role)
    VALUES (user_email, 'admin')
    ON CONFLICT (email) DO UPDATE SET role = 'admin';
    
    RAISE NOTICE 'Assigned admin role to %', user_email;
END $$;

-- ============================================================================
-- ASSIGN REPRESENTATIVE ROLE
-- ============================================================================

-- Example: Make student@example.com a representative for CSE 2024 Admission Batch
-- Note: 2024 refers to ADMISSION YEAR (when batch joined), not current academic year
DO $$
DECLARE
    user_email TEXT := 'student@example.com';  -- CHANGE THIS EMAIL
    branch_code TEXT := 'CSE';                 -- CHANGE THIS BRANCH
    admission_year INT := 2024;                -- CHANGE THIS ADMISSION YEAR (when batch joined)
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
    
    RAISE NOTICE 'Assigned % as representative for % % admission batch', user_email, branch_code, admission_year;
END $$;

-- ============================================================================
-- ASSIGN MULTIPLE REPRESENTATIVE SCOPES
-- ============================================================================

-- Example: Make student@example.com a representative for multiple branch/year combinations
DO $$
DECLARE
    user_email TEXT := 'student@example.com';  -- CHANGE THIS EMAIL
    user_uuid UUID;
    assignment RECORD;
    branch_uuid UUID;
    year_uuid UUID;
    
    -- Define assignments: (branch_code, batch_year)
    assignments TEXT[][] := ARRAY[
        ['CSE', '2024'],
        ['CSE', '2023'],
        ['AIML', '2024']
    ];
BEGIN
    -- Get user ID
    SELECT id INTO user_uuid 
    FROM profiles 
    WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User not found: %', user_email;
    END IF;
    
    -- Update profile role
    UPDATE profiles 
    SET role = 'representative' 
    WHERE id = user_uuid;
    
    -- Create assignments
    FOR i IN 1..array_length(assignments, 1) LOOP
        -- Get branch ID
        SELECT id INTO branch_uuid 
        FROM branches 
        WHERE code = assignments[i][1];
        
        -- Get year ID  
        SELECT id INTO year_uuid 
        FROM years 
        WHERE years.batch_year = assignments[i][2]::INT;
        
        IF branch_uuid IS NOT NULL AND year_uuid IS NOT NULL THEN
            INSERT INTO representatives (user_id, branch_id, year_id, active)
            VALUES (user_uuid, branch_uuid, year_uuid, true)
            ON CONFLICT (user_id, branch_id, year_id) 
            DO UPDATE SET active = true;
            
            RAISE NOTICE 'Assigned scope: % Year %', assignments[i][1], assignments[i][2];
        ELSE
            RAISE WARNING 'Skipped invalid assignment: % Year %', assignments[i][1], assignments[i][2];
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed representative assignment for %', user_email;
END $$;

-- ============================================================================
-- REMOVE REPRESENTATIVE ROLE
-- ============================================================================

-- Example: Remove representative role from user@example.com
DO $$
DECLARE
    user_email TEXT := 'student@example.com';  -- CHANGE THIS EMAIL
    user_uuid UUID;
BEGIN
    -- Get user ID
    SELECT id INTO user_uuid 
    FROM profiles 
    WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User not found: %', user_email;
    END IF;
    
    -- Deactivate all representative assignments
    UPDATE representatives 
    SET active = false 
    WHERE user_id = user_uuid;
    
    -- Change role back to student
    UPDATE profiles 
    SET role = 'student' 
    WHERE id = user_uuid;
    
    RAISE NOTICE 'Removed representative role from %', user_email;
END $$;

-- ============================================================================
-- QUERY EXAMPLES - VIEW CURRENT ROLE ASSIGNMENTS
-- ============================================================================

-- View all users and their roles
SELECT 
    email,
    name, 
    role,
    year,
    branch,
    roll_number,
    created_at
FROM profiles 
ORDER BY role, email;

-- View all representative assignments
SELECT 
    p.email,
    p.name,
    p.role,
    b.code as branch,
    y.batch_year as year,
    r.active,
    r.assigned_at
FROM representatives r
JOIN profiles p ON r.user_id = p.id
JOIN branches b ON r.branch_id = b.id  
JOIN years y ON r.year_id = y.id
ORDER BY p.email, b.code, y.batch_year;

-- View all admins
SELECT 
    a.email,
    a.role as admin_role,
    p.name,
    p.role as profile_role,
    a.created_at
FROM admins a
LEFT JOIN profiles p ON a.email = p.email
ORDER BY a.role, a.email;

-- View semester promotion history
SELECT 
    sp.id,
    p.email as promoted_by,
    p.name as promoter_name,
    b.code as branch,
    y.batch_year as year,
    fs.semester_number as from_semester,
    ts.semester_number as to_semester,
    sp.promotion_date,
    sp.notes
FROM semester_promotions sp
JOIN profiles p ON sp.promoted_by = p.id
JOIN branches b ON sp.branch_id = b.id
JOIN years y ON sp.year_id = y.id
JOIN semesters fs ON sp.from_semester_id = fs.id
JOIN semesters ts ON sp.to_semester_id = ts.id
ORDER BY sp.promotion_date DESC;

-- ============================================================================
-- BULK OPERATIONS
-- ============================================================================

-- Assign multiple users as representatives for the same branch/year
DO $$
DECLARE
    branch_code TEXT := 'CSE';     -- CHANGE THIS
    batch_year INT := 2024;        -- CHANGE THIS
    user_emails TEXT[] := ARRAY[   -- CHANGE THESE EMAILS
        'rep1@example.com',
        'rep2@example.com',
        'rep3@example.com'
    ];
    user_email TEXT;
    user_uuid UUID;
    branch_uuid UUID;
    year_uuid UUID;
BEGIN
    -- Get branch and year IDs
    SELECT id INTO branch_uuid FROM branches WHERE code = branch_code;
    SELECT id INTO year_uuid FROM years WHERE years.batch_year = batch_year;
    
    IF branch_uuid IS NULL THEN
        RAISE EXCEPTION 'Branch not found: %', branch_code;
    END IF;
    
    IF year_uuid IS NULL THEN
        RAISE EXCEPTION 'Year not found: %', batch_year;
    END IF;
    
    -- Assign each user
    FOREACH user_email IN ARRAY user_emails LOOP
        SELECT id INTO user_uuid FROM profiles WHERE email = user_email;
        
        IF user_uuid IS NOT NULL THEN
            -- Update role
            UPDATE profiles SET role = 'representative' WHERE id = user_uuid;
            
            -- Create assignment
            INSERT INTO representatives (user_id, branch_id, year_id, active)
            VALUES (user_uuid, branch_uuid, year_uuid, true)
            ON CONFLICT (user_id, branch_id, year_id) 
            DO UPDATE SET active = true;
            
            RAISE NOTICE 'Assigned representative: %', user_email;
        ELSE
            RAISE WARNING 'User not found: %', user_email;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- CLEANUP OPERATIONS
-- ============================================================================

-- Remove all inactive representative assignments
DELETE FROM representatives WHERE active = false;

-- Reset all users with representative role but no active assignments back to student
UPDATE profiles 
SET role = 'student' 
WHERE role = 'representative' 
AND id NOT IN (
    SELECT user_id 
    FROM representatives 
    WHERE active = true
);

-- View users who might need role cleanup
SELECT 
    p.email,
    p.role,
    COUNT(r.id) as active_assignments
FROM profiles p
LEFT JOIN representatives r ON p.id = r.user_id AND r.active = true
WHERE p.role = 'representative'
GROUP BY p.id, p.email, p.role
HAVING COUNT(r.id) = 0;
