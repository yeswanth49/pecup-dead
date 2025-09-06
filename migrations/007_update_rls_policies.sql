-- Migration 007: Update Row Level Security Policies
-- Comprehensive RLS policy updates for the new unified schema
-- Ensures proper access control across all tables
-- Based on Supabase authentication and role-based permissions

BEGIN;

-- Phase 7.1: Enable RLS on all new tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Phase 7.2: Users table policies

-- Users can read their own profile
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (
    auth.jwt() ->> 'email' = email
    AND deleted_at IS NULL
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (
    auth.jwt() ->> 'email' = email
    AND deleted_at IS NULL
  )
  WITH CHECK (
    -- Prevent users from changing critical fields
    OLD.email = NEW.email
    AND OLD.role = NEW.role
    AND OLD.auth_user_id = NEW.auth_user_id
  );

-- Admins can read all users
CREATE POLICY "admins_read_all_users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
      AND u.deleted_at IS NULL
    )
  );

-- Admins can update users (with restrictions)
CREATE POLICY "admins_update_users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users admin_u
      WHERE admin_u.auth_user_id = auth.uid()
      AND admin_u.role IN ('admin', 'superadmin')
      AND admin_u.deleted_at IS NULL
    )
  );

-- Superadmins can delete users (soft delete)
CREATE POLICY "superadmins_delete_users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users admin_u
      WHERE admin_u.auth_user_id = auth.uid()
      AND admin_u.role = 'superadmin'
      AND admin_u.deleted_at IS NULL
    )
  )
  WITH CHECK (
    NEW.deleted_at IS NOT NULL  -- Only allow soft deletes
  );

-- Phase 7.3: User profiles policies

-- Users can read their own profile
CREATE POLICY "user_profiles_read_own" ON user_profiles
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
  );

-- Users can update their own profile
CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
  );

-- Users can insert their own profile
CREATE POLICY "user_profiles_insert_own" ON user_profiles
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
  );

-- Admins can read all profiles
CREATE POLICY "admins_read_all_profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
      AND u.deleted_at IS NULL
    )
  );

-- Admins can manage profiles in their scope
CREATE POLICY "admins_manage_scoped_profiles" ON user_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users admin_u
      JOIN admin_profiles ap ON admin_u.id = ap.user_id
      WHERE admin_u.auth_user_id = auth.uid()
      AND admin_u.role IN ('admin', 'superadmin')
      AND admin_u.deleted_at IS NULL
      AND (
        -- Global admin scope
        ap.admin_scope->>'scope_type' = 'global'
        OR
        -- Branch-specific scope
        (ap.admin_scope->>'scope_type' = 'scoped'
         AND user_profiles.branch_id::text = ap.admin_scope->>'branch_id')
      )
    )
  );

-- Phase 7.4: Admin profiles policies

-- Admins can read their own admin profile
CREATE POLICY "admin_profiles_read_own" ON admin_profiles
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
  );

-- Only superadmins can manage admin profiles
CREATE POLICY "superadmins_manage_admin_profiles" ON admin_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'superadmin'
      AND u.deleted_at IS NULL
    )
  );

-- Phase 7.5: Resources policies

-- Users can read resources relevant to them
CREATE POLICY "resources_read_relevant" ON resources_new
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      -- Own resources
      uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
      OR
      -- Resources in user's branch/year
      branch_id IN (
        SELECT up.branch_id FROM user_profiles up
        WHERE up.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
      )
      OR
      -- Admin access
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.auth_user_id = auth.uid()
        AND u.role IN ('admin', 'superadmin')
        AND u.deleted_at IS NULL
      )
    )
  );

-- Users can upload resources
CREATE POLICY "resources_insert_own" ON resources_new
  FOR INSERT WITH CHECK (
    uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
    AND deleted_at IS NULL
  );

-- Users can update their own resources
CREATE POLICY "resources_update_own" ON resources_new
  FOR UPDATE USING (
    uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
    AND deleted_at IS NULL
  );

-- Admins can manage all resources
CREATE POLICY "admins_manage_resources" ON resources_new
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
      AND u.deleted_at IS NULL
    )
  );

-- Phase 7.6: Resource files policies

-- Users can read files for resources they can access
CREATE POLICY "resource_files_read_accessible" ON resource_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM resources_new r
      WHERE r.id = resource_files.resource_id
      AND r.deleted_at IS NULL
      AND (
        r.uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR r.branch_id IN (
          SELECT up.branch_id FROM user_profiles up
          WHERE up.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        )
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.auth_user_id = auth.uid()
          AND u.role IN ('admin', 'superadmin')
          AND u.deleted_at IS NULL
        )
      )
    )
  );

-- Users can manage files for their resources
CREATE POLICY "resource_files_manage_own" ON resource_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM resources_new r
      WHERE r.id = resource_files.resource_id
      AND r.uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- Admins can manage all resource files
CREATE POLICY "admins_manage_resource_files" ON resource_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
      AND u.deleted_at IS NULL
    )
  );

-- Phase 7.7: Resource metadata policies

-- Same access pattern as resources
CREATE POLICY "resource_metadata_read_accessible" ON resource_metadata
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM resources_new r
      WHERE r.id = resource_metadata.resource_id
      AND r.deleted_at IS NULL
      AND (
        r.uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR r.branch_id IN (
          SELECT up.branch_id FROM user_profiles up
          WHERE up.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        )
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.auth_user_id = auth.uid()
          AND u.role IN ('admin', 'superadmin')
          AND u.deleted_at IS NULL
        )
      )
    )
  );

CREATE POLICY "resource_metadata_manage_own" ON resource_metadata
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM resources_new r
      WHERE r.id = resource_metadata.resource_id
      AND r.uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

CREATE POLICY "admins_manage_resource_metadata" ON resource_metadata
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
      AND u.deleted_at IS NULL
    )
  );

-- Phase 7.8: Audit logs policies

-- All authenticated users can insert audit logs
CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs
  FOR INSERT WITH CHECK (
    actor_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
  );

-- Only admins can read audit logs
CREATE POLICY "admins_read_audit_logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
      AND u.deleted_at IS NULL
    )
  );

-- Phase 7.9: Settings policies

-- All authenticated users can read settings
CREATE POLICY "settings_read_authenticated" ON app_settings
  FOR SELECT TO authenticated USING (true);

-- Only superadmins can modify settings
CREATE POLICY "superadmins_manage_settings" ON app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'superadmin'
      AND u.deleted_at IS NULL
    )
  );

-- Phase 7.10: Create helper function for checking admin access
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role IN ('admin', 'superadmin')
    AND u.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for checking superadmin access
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'superadmin'
    AND u.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for checking if user owns resource
CREATE OR REPLACE FUNCTION owns_resource(resource_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM resources_new r
    WHERE r.id = resource_id_param
    AND r.uploader_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
    AND r.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 7.11: Verification queries
SELECT '=== MIGRATION 007 VERIFICATION ===' as section;

-- Check RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'users', 'user_profiles', 'admin_profiles',
  'resources_new', 'resource_files', 'resource_metadata',
  'audit_logs', 'app_settings'
)
ORDER BY tablename;

-- Count policies per table
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'users', 'user_profiles', 'admin_profiles',
  'resources_new', 'resource_files', 'resource_metadata',
  'audit_logs', 'app_settings'
)
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Test helper functions (will work when called in authenticated context)
SELECT 'Helper functions created:' as check,
  COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_admin', 'is_superadmin', 'owns_resource');

COMMIT;

-- Post-migration notes:
-- 1. **TESTING REQUIRED:**
--    - Test all policies with different user roles
--    - Verify students can only see relevant resources
--    - Verify admins have appropriate access levels
--    - Test superadmin-only operations
--
-- 2. **PERFORMANCE CONSIDERATIONS:**
--    - RLS policies add overhead to queries
--    - Monitor query performance after deployment
--    - Consider adding indexes on frequently filtered columns
--
-- 3. **SECURITY AUDIT:**
--    - Review all policies for potential security gaps
--    - Ensure no privilege escalation vulnerabilities
--    - Test with various authentication scenarios
--
-- 4. **MONITORING:**
--    - Set up alerts for RLS policy violations
--    - Monitor query performance impact
--    - Track authentication failures
--
-- 5. **DOCUMENTATION:**
--    - Update API documentation with new access patterns
--    - Document admin scope functionality
--    - Create user permission reference guide
