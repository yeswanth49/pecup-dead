-- Database Refactoring Phase 7: Enable Row Level Security (RLS)
-- This migration enables RLS on new tables and creates appropriate policies

-- Phase 7.1: Enable RLS on new tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE years ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_calendar ENABLE ROW LEVEL SECURITY;

-- Phase 7.2: Create RLS policies for branches table
-- Branches: public read, admin write
DROP POLICY IF EXISTS "Public read access on branches" ON branches;
CREATE POLICY "Public read access on branches" ON branches 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write access on branches" ON branches;
CREATE POLICY "Admin write access on branches" ON branches 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE email = (auth.jwt() ->> 'email')::text
    )
  );

-- Phase 7.3: Create RLS policies for years table
-- Years: public read, admin write
DROP POLICY IF EXISTS "Public read access on years" ON years;
CREATE POLICY "Public read access on years" ON years 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write access on years" ON years;
CREATE POLICY "Admin write access on years" ON years 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE email = (auth.jwt() ->> 'email')::text
    )
  );

-- Phase 7.4: Create RLS policies for semesters table
-- Semesters: public read, admin write
DROP POLICY IF EXISTS "Public read access on semesters" ON semesters;
CREATE POLICY "Public read access on semesters" ON semesters 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write access on semesters" ON semesters;
CREATE POLICY "Admin write access on semesters" ON semesters 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE email = (auth.jwt() ->> 'email')::text
    )
  );

-- Phase 7.5: Create RLS policies for students table
-- Students: users can read their own data, admins can read all
DROP POLICY IF EXISTS "Users can view own profile" ON students;
CREATE POLICY "Users can view own profile" ON students 
  FOR SELECT USING (
    email = (auth.jwt() ->> 'email')::text
  );

DROP POLICY IF EXISTS "Admin read access on students" ON students;
CREATE POLICY "Admin read access on students" ON students 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE email = (auth.jwt() ->> 'email')::text
    )
  );

DROP POLICY IF EXISTS "Admin write access on students" ON students;
CREATE POLICY "Admin write access on students" ON students 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE email = (auth.jwt() ->> 'email')::text
    )
  );

-- Allow students to update their own profile
DROP POLICY IF EXISTS "Students can update own profile" ON students;
CREATE POLICY "Students can update own profile" ON students 
  FOR UPDATE USING (
    email = (auth.jwt() ->> 'email')::text
  );

-- Phase 7.6: Create RLS policies for academic calendar
-- Academic calendar: public read, superadmin write
DROP POLICY IF EXISTS "Public read access on academic_calendar" ON academic_calendar;
CREATE POLICY "Public read access on academic_calendar" ON academic_calendar 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Superadmin write access on academic_calendar" ON academic_calendar;
CREATE POLICY "Superadmin write access on academic_calendar" ON academic_calendar 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE email = (auth.jwt() ->> 'email')::text 
      AND role = 'superadmin'
    )
  );

-- Phase 7.7: Update RLS policies for resources table (if needed)
-- Resources: students can see resources for their branch/year/semester, admins see all
-- Students can see resources that match their academic context
DROP POLICY IF EXISTS "Students can view relevant resources" ON resources;
CREATE POLICY "Students can view relevant resources" ON resources 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.email = (auth.jwt() ->> 'email')::text
      AND s.branch_id = resources.branch_id
      AND s.year_id = resources.year_id
      AND s.semester_id = resources.semester_id
    )
  );

-- Admins can see all resources
DROP POLICY IF EXISTS "Admin read access on resources" ON resources;
CREATE POLICY "Admin read access on resources" ON resources 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE email = (auth.jwt() ->> 'email')::text
    )
  );

-- Admins can manage all resources
DROP POLICY IF EXISTS "Admin write access on resources" ON resources;
CREATE POLICY "Admin write access on resources" ON resources 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE email = (auth.jwt() ->> 'email')::text
    )
  );

-- Students can upload resources (if uploader_id is set to their student ID)
DROP POLICY IF EXISTS "Students can upload resources" ON resources;
CREATE POLICY "Students can upload resources" ON resources 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.email = (auth.jwt() ->> 'email')::text
      AND s.id = resources.uploader_id
    )
  );

-- Students can update resources they uploaded
DROP POLICY IF EXISTS "Students can update own uploads" ON resources;
CREATE POLICY "Students can update own uploads" ON resources 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.email = (auth.jwt() ->> 'email')::text
      AND s.id = resources.uploader_id
    )
  );

-- Phase 7.8: Create helper function for checking admin access
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins 
    WHERE email = (auth.jwt() ->> 'email')::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function for checking superadmin access
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins 
    WHERE email = (auth.jwt() ->> 'email')::text 
    AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function for getting current student ID
CREATE OR REPLACE FUNCTION current_student_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT id FROM students 
    WHERE email = (auth.jwt() ->> 'email')::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 7.9: Test RLS policies (verification queries)
DO $$ 
BEGIN
  RAISE NOTICE '=== RLS POLICIES VERIFICATION ===';
  
  -- Check if RLS is enabled on all new tables
  FOR table_name IN VALUES ('branches'), ('years'), ('semesters'), ('students'), ('academic_calendar')
  LOOP
    RAISE NOTICE 'Checking RLS status for table: %', table_name.table_name;
    
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = table_name.table_name 
      AND rowsecurity = true
    ) THEN
      RAISE NOTICE '  ✓ RLS is enabled for %', table_name.table_name;
    ELSE
      RAISE WARNING '  ✗ RLS is NOT enabled for %', table_name.table_name;
    END IF;
  END LOOP;
  
  -- Count policies created
  FOR table_name IN VALUES ('branches'), ('years'), ('semesters'), ('students'), ('academic_calendar'), ('resources')
  LOOP
    DECLARE
      policy_count integer;
    BEGIN
      SELECT COUNT(*) INTO policy_count
      FROM pg_policies 
      WHERE tablename = table_name.table_name;
      
      RAISE NOTICE 'Table % has % RLS policies', table_name.table_name, policy_count;
    END;
  END LOOP;
  
  RAISE NOTICE '=== END RLS VERIFICATION ===';
END $$;

-- Phase 7.10: Grant necessary permissions
-- Grant usage on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION current_student_id() TO authenticated;

-- Add comments to document the RLS setup
COMMENT ON POLICY "Public read access on branches" ON branches IS 'All users can read branch information';
COMMENT ON POLICY "Admin write access on branches" ON branches IS 'Only admins can create/update/delete branches';

COMMENT ON POLICY "Public read access on years" ON years IS 'All users can read year information';
COMMENT ON POLICY "Admin write access on years" ON years IS 'Only admins can create/update/delete years';

COMMENT ON POLICY "Public read access on semesters" ON semesters IS 'All users can read semester information';
COMMENT ON POLICY "Admin write access on semesters" ON semesters IS 'Only admins can create/update/delete semesters';

COMMENT ON POLICY "Users can view own profile" ON students IS 'Students can view their own profile data';
COMMENT ON POLICY "Admin read access on students" ON students IS 'Admins can view all student profiles';
COMMENT ON POLICY "Admin write access on students" ON students IS 'Admins can manage all student records';
COMMENT ON POLICY "Students can update own profile" ON students IS 'Students can update their own profile information';

COMMENT ON POLICY "Public read access on academic_calendar" ON academic_calendar IS 'All users can read current academic calendar';
COMMENT ON POLICY "Superadmin write access on academic_calendar" ON academic_calendar IS 'Only superadmins can manage academic calendar';

COMMENT ON POLICY "Students can view relevant resources" ON resources IS 'Students see resources for their branch/year/semester';
COMMENT ON POLICY "Admin read access on resources" ON resources IS 'Admins can view all resources';
COMMENT ON POLICY "Admin write access on resources" ON resources IS 'Admins can manage all resources';
COMMENT ON POLICY "Students can upload resources" ON resources IS 'Students can upload resources to their academic context';
COMMENT ON POLICY "Students can update own uploads" ON resources IS 'Students can update resources they uploaded';

RAISE NOTICE 'Phase 7 - Row Level Security setup completed successfully!';
