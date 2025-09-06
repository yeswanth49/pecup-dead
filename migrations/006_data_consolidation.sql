-- Migration 006: Data Consolidation and Cleanup
-- Final migration to consolidate data and clean up old schema
-- Addresses remaining issues from Red Flags #1-6
-- Should be run after all other migrations are verified

BEGIN;

-- Phase 6.1: Update all domain tables to use FK relationships

-- Update user_profiles with proper FK relationships (conditional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
  ) THEN
    -- Update branch_id
    UPDATE user_profiles
    SET branch_id = b.id
    FROM branches b
    WHERE user_profiles.id IN (
      SELECT up.id
      FROM user_profiles up
      JOIN profiles p ON p.email = (SELECT u.email FROM users u WHERE u.id = up.user_id)
      WHERE p.branch::text = b.code
    );

    -- Update year_id
    UPDATE user_profiles
    SET year_id = y.id
    FROM years y
    WHERE user_profiles.id IN (
      SELECT up.id
      FROM user_profiles up
      JOIN profiles p ON p.email = (SELECT u.email FROM users u WHERE u.id = up.user_id)
      WHERE y.batch_year = (EXTRACT(YEAR FROM current_date) - (p.year - 1))
    );

    RAISE NOTICE 'Updated user_profiles branch and year FKs from profiles data';
  ELSE
    RAISE NOTICE 'profiles table does not exist, skipping FK relationship updates';
  END IF;

  -- Update semester_id (this can work with existing year_id data)
  UPDATE user_profiles
  SET semester_id = s.id
  FROM semesters s
  WHERE user_profiles.id IN (
    SELECT up.id
    FROM user_profiles up
    JOIN user_profiles up2 ON up2.id = up.id
    JOIN years y ON y.id = up2.year_id
    WHERE s.year_id = y.id AND s.semester_number = 1  -- Default to semester 1
  );
END $$;

-- Phase 6.2: Create backup tables for safety (conditional)
DO $$
BEGIN
  -- Create backup tables only if source tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS profiles_backup AS SELECT * FROM profiles';
    RAISE NOTICE 'Created profiles_backup';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS students_backup AS SELECT * FROM students';
    RAISE NOTICE 'Created students_backup';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admins') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS admins_backup AS SELECT * FROM admins';
    RAISE NOTICE 'Created admins_backup';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resources') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS resources_backup AS SELECT * FROM resources';
    RAISE NOTICE 'Created resources_backup';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS settings_backup AS SELECT * FROM settings';
    RAISE NOTICE 'Created settings_backup';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS audit_logs_backup AS SELECT * FROM audit_logs';
    RAISE NOTICE 'Created audit_logs_backup';
  END IF;
END $$;

-- Phase 6.3: Update remaining domain tables to use new FKs

-- Update resources_new with uploader_id from users
UPDATE resources_new
SET uploader_id = u.id
FROM users u
WHERE resources_new.uploader_id IS NULL
AND resources_new.id IN (
  SELECT rn.id
  FROM resources_new rn
  JOIN resources r ON (
    rn.title = COALESCE(r.name, 'Untitled Resource') AND
    rn.category = r.category AND
    rn.subject = r.subject AND
    rn.unit = r.unit
  )
  LEFT JOIN profiles p ON p.id = r.created_by
  LEFT JOIN admins a ON a.id = r.created_by
  WHERE (p.email IS NOT NULL OR a.email IS NOT NULL)
  AND u.email = COALESCE(p.email, a.email)
);

-- Update admin_scopes to use user_id instead of admin_id
ALTER TABLE admin_scopes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
UPDATE admin_scopes
SET user_id = u.id
FROM users u
JOIN admins a ON a.email = u.email
WHERE admin_scopes.admin_id = a.id;

-- Phase 6.4: Update RLS policies for new schema structure

-- Drop old RLS policies that reference old tables
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Admins can read all students" ON students;
DROP POLICY IF EXISTS "Users can read own resources" ON resources;
DROP POLICY IF EXISTS "Admins can manage audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can manage settings" ON settings;

-- Create new RLS policies for unified schema

-- Users table policies
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "admins_read_all_users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- User profiles policies
CREATE POLICY "user_profiles_read_own" ON user_profiles
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "admins_read_all_profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- Resources policies (now support all user types)
CREATE POLICY "resources_read_relevant" ON resources_new
  FOR SELECT USING (
    uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR branch_id IN (
      SELECT up.branch_id FROM user_profiles up
      WHERE up.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "resources_insert_own" ON resources_new
  FOR INSERT WITH CHECK (
    uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "resources_update_own" ON resources_new
  FOR UPDATE USING (
    uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- Audit logs policies
CREATE POLICY "audit_logs_read_admins" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "audit_logs_insert_all" ON audit_logs
  FOR INSERT WITH CHECK (
    actor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Settings policies
CREATE POLICY "settings_read_all" ON app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "settings_update_admins" ON app_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- Phase 6.5: Create helper views for gradual migration

-- View for old profiles table compatibility
CREATE OR REPLACE VIEW profiles_compat AS
SELECT
  u.id,
  u.email,
  u.name,
  CASE
    WHEN up.year_id IS NOT NULL THEN
      (SELECT y.batch_year - EXTRACT(YEAR FROM current_date) + 1 FROM years y WHERE y.id = up.year_id)
    ELSE NULL
  END as year,
  b.code as branch,
  up.roll_number,
  u.role,
  u.created_at,
  u.updated_at
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN branches b ON up.branch_id = b.id
WHERE u.role = 'student';

-- Phase 6.6: Update database comments and documentation
COMMENT ON TABLE users IS 'Canonical users table - single source of truth for all user identities';
COMMENT ON TABLE user_profiles IS 'Academic profiles extending users table for students';
COMMENT ON TABLE admin_profiles IS 'Admin-specific extensions for users with admin roles';
COMMENT ON TABLE resources_new IS 'Core resource metadata (normalized from overloaded resources table)';
COMMENT ON TABLE resource_files IS 'File storage information for resources';
COMMENT ON TABLE resource_metadata IS 'Extensible metadata for resources';
COMMENT ON TABLE audit_logs IS 'Audit trail for all system actions with unified actor reference';
COMMENT ON TABLE app_settings IS 'Application settings with proper key-value structure';

-- Phase 6.7: Create data integrity constraints

-- Ensure users have valid auth_user_id
ALTER TABLE users ADD CONSTRAINT users_auth_user_id_not_null
  CHECK (auth_user_id IS NOT NULL);

-- Ensure resources have valid uploader
ALTER TABLE resources_new ADD CONSTRAINT resources_uploader_not_null
  CHECK (uploader_id IS NOT NULL);

-- Ensure audit logs have valid actor
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_not_null
  CHECK (actor_id IS NOT NULL);

-- Phase 6.8: Final verification queries
SELECT '=== MIGRATION 006 VERIFICATION ===' as section;

-- User consolidation verification
SELECT 'Users consolidated:' as check, COUNT(*) as count FROM users;
SELECT 'User profiles linked:' as check, COUNT(*) as count FROM user_profiles WHERE user_id IS NOT NULL;
SELECT 'Admin profiles linked:' as check, COUNT(*) as count FROM admin_profiles WHERE user_id IS NOT NULL;

-- Resource migration verification
SELECT 'Resources migrated:' as check, COUNT(*) as count FROM resources_new;
SELECT 'Resource files linked:' as check, COUNT(*) as count FROM resource_files;
SELECT 'Resource metadata entries:' as check, COUNT(*) as count FROM resource_metadata;

-- FK integrity checks
SELECT 'Orphaned user profiles:' as check, COUNT(*) as count
FROM user_profiles up
LEFT JOIN users u ON up.user_id = u.id
WHERE u.id IS NULL;

SELECT 'Orphaned admin profiles:' as check, COUNT(*) as count
FROM admin_profiles ap
LEFT JOIN users u ON ap.user_id = u.id
WHERE u.id IS NULL;

SELECT 'Resources without uploader:' as check, COUNT(*) as count
FROM resources_new r
WHERE r.uploader_id IS NULL;

SELECT 'Audit logs without actor:' as check, COUNT(*) as count
FROM audit_logs al
WHERE al.actor_id IS NULL;

-- Settings verification
SELECT 'App settings configured:' as check, COUNT(*) as count FROM app_settings;

COMMIT;

-- Post-migration notes:
-- 1. **IMMEDIATE NEXT STEPS:**
--    - Update application code to use new table names
--    - Test all CRUD operations with new schema
--    - Verify RLS policies work correctly
--
-- 2. **GRADUAL CLEANUP (after 2-4 weeks of testing):**
--    - Drop old tables: profiles, students, admins, resources, settings
--    - Rename resources_new to resources
--    - Remove compatibility views and functions
--
-- 3. **MONITORING:**
--    - Watch for orphaned records
--    - Monitor query performance with new FKs
--    - Track RLS policy effectiveness
--
-- 4. **ROLLBACK PLAN:**
--    - Restore from backup tables if issues arise
--    - Have old application code ready to deploy
--
-- 5. **FUTURE CONSIDERATIONS:**
--    - Consider adding database triggers for automatic audit logging
--    - Implement resource versioning if compliance requires it
--    - Add more validation constraints as business rules evolve
