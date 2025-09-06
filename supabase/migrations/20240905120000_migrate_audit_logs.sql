-- Migration 004: Migrate Audit Logs to Unified Actor Reference
-- Addresses Red Flag #4: Audit Logs Actor Mismatch
-- Updates audit logs to use single FK to canonical users table
-- Preserves legacy actor information for compliance

BEGIN;

-- Phase 4.1: Add new actor_id column referencing users table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES users(id);
  ELSE
    RAISE NOTICE 'Skipping audit_logs alterations; table does not exist';
  END IF;
END $$;

-- Add index for performance
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_new ON audit_logs(actor_id);
  END IF;
END $$;

-- Phase 4.2: Create mapping function for actor resolution
CREATE OR REPLACE FUNCTION resolve_actor_id(actor_email_param text, actor_role_param text)
RETURNS uuid AS $$
DECLARE
  resolved_user_id uuid;
BEGIN
  -- Try to find user by email
  SELECT id INTO resolved_user_id
  FROM users
  WHERE email = actor_email_param
  LIMIT 1;

  -- If not found, create a system user for legacy audit entries
  IF resolved_user_id IS NULL THEN
    INSERT INTO users (auth_user_id, email, name, role, created_at)
    VALUES (
      gen_random_uuid(),
      actor_email_param,
      COALESCE(actor_email_param, 'Legacy User'),
      CASE
        WHEN actor_role_param = 'superadmin' THEN 'superadmin'::user_role
        WHEN actor_role_param = 'admin' THEN 'admin'::user_role
        ELSE 'student'::user_role
      END,
      now()
    )
    RETURNING id INTO resolved_user_id;
  END IF;

  RETURN resolved_user_id;
END;
$$ LANGUAGE plpgsql;

-- Phase 4.3: Migrate existing actor references
-- Update audit logs with resolved user IDs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    UPDATE audit_logs
    SET actor_id = resolve_actor_id(actor_email, actor_role::text)
    WHERE actor_id IS NULL;
  END IF;
END $$;

-- Phase 4.4: Preserve legacy information in metadata
-- Store old actor info in before_data for compliance and debugging
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    UPDATE audit_logs
    SET before_data = COALESCE(before_data, '{}'::jsonb) || jsonb_build_object(
      'legacy_actor_email', actor_email,
      'legacy_actor_role', actor_role::text,
      'legacy_actor_id', actor_id_legacy,
      'migrated_at', now()::text
    )
    WHERE actor_id IS NOT NULL;
  END IF;
END $$;

-- Phase 4.5: Add new columns for enhanced audit tracking
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address inet;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
  END IF;
END $$;

-- Add indexes for new columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  END IF;
END $$;

-- Phase 4.6: Update existing actor_id references
-- Handle cases where actor_id was already set but needs updating
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    UPDATE audit_logs
    SET actor_id = sub.resolved_id
    FROM (
      SELECT
        al.id as audit_log_id,
        resolve_actor_id(al.actor_email, al.actor_role::text) as resolved_id
      FROM audit_logs al
      WHERE al.actor_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = al.actor_id
      )
    ) sub
    WHERE audit_logs.id = sub.audit_log_id;
  END IF;
END $$;

-- Phase 4.7: Create audit helper functions

-- Function to log action with unified actor reference
CREATE OR REPLACE FUNCTION audit_log_action(
  actor_user_id uuid,
  action_type text,
  entity_type text,
  entity_identifier text DEFAULT NULL,
  success_flag boolean DEFAULT true,
  message_text text DEFAULT NULL,
  before_state jsonb DEFAULT NULL,
  after_state jsonb DEFAULT NULL,
  client_ip inet DEFAULT NULL,
  client_user_agent text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  audit_id uuid;
BEGIN
  INSERT INTO audit_logs (
    actor_id, action, entity, entity_id, success,
    message, before_data, after_data, ip_address, user_agent
  )
  VALUES (
    actor_user_id, action_type, entity_type, entity_identifier, success_flag,
    message_text, before_state, after_state, client_ip, client_user_agent
  )
  RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit trail for an entity
CREATE OR REPLACE FUNCTION get_entity_audit_trail(
  entity_type_param text,
  entity_id_param text,
  limit_count integer DEFAULT 100
)
RETURNS TABLE (
  audit_id uuid,
  actor_email text,
  actor_name text,
  action text,
  success boolean,
  message text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id as audit_id,
    u.email as actor_email,
    u.name as actor_name,
    al.action,
    al.success,
    al.message,
    al.created_at
  FROM audit_logs al
  JOIN users u ON al.actor_id = u.id
  WHERE al.entity = entity_type_param
  AND al.entity_id = entity_id_param
  ORDER BY al.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Phase 4.8: Verification queries
DO $$
DECLARE cnt bigint;
BEGIN
  RAISE NOTICE '=== MIGRATION 004 VERIFICATION ===';
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    SELECT COUNT(*) INTO cnt FROM audit_logs;
    RAISE NOTICE 'Total audit logs: %', cnt;
    SELECT COUNT(*) INTO cnt FROM audit_logs WHERE actor_id IS NOT NULL;
    RAISE NOTICE 'Audit logs with new actor_id: %', cnt;
    SELECT COUNT(*) INTO cnt FROM audit_logs WHERE actor_id IS NULL;
    RAISE NOTICE 'Audit logs missing actor_id: %', cnt;
  ELSE
    RAISE NOTICE 'audit_logs table not present; skipping verification';
  END IF;
END $$;

DO $$
DECLARE cnt2 bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    SELECT COUNT(*) INTO cnt2
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.id
    WHERE al.actor_id IS NOT NULL AND u.id IS NULL;
    RAISE NOTICE 'Orphaned audit logs (actor not in users): %', cnt2;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    RAISE NOTICE 'Sample audit logs after migration:';
    PERFORM 1 FROM (
      SELECT al.action, al.entity, al.entity_id, u.email, u.name, al.success, al.created_at
      FROM audit_logs al
      JOIN users u ON al.actor_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 10
    ) t;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    RAISE NOTICE 'Audit logs by actor role:';
    PERFORM 1 FROM (
      SELECT u.role, COUNT(*)
      FROM audit_logs al
      JOIN users u ON al.actor_id = u.id
      GROUP BY u.role
      ORDER BY COUNT(*) DESC
    ) t;
  END IF;
END $$;

COMMIT;

-- Post-migration notes:
-- 1. Update application code to use audit_log_action() function
-- 2. Update all places that insert into audit_logs to use actor_id
-- 3. Consider dropping legacy columns after full verification:
--    - actor_email (after confirming all references migrated)
--    - actor_role (after confirming role info preserved in users table)
--    - actor_id_legacy (if it exists)
-- 4. Update RLS policies to work with users table reference
-- 5. Monitor for any missing actor_id entries and resolve manually
