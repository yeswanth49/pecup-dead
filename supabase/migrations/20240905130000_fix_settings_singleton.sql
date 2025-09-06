-- Migration 005: Fix Settings Singleton Design
-- Addresses Red Flag #5: Settings Table Design Smell
-- Replaces hacky singleton with proper key-value structure
-- Maintains backwards compatibility during transition

BEGIN;

-- Phase 5.1: Create new settings table with proper structure
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Phase 5.2: Migrate existing settings data
-- Extract values from the old singleton settings table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='settings'
  ) THEN
    INSERT INTO app_settings (setting_key, setting_value, description, updated_at)
    SELECT
      'drive_folder_id' as setting_key,
      to_jsonb(drive_folder_id) as setting_value,
      'Google Drive folder ID for resource storage' as description,
      updated_at
    FROM settings
    WHERE drive_folder_id IS NOT NULL

    UNION ALL

    SELECT
      'storage_bucket' as setting_key,
      to_jsonb(storage_bucket) as setting_value,
      'Supabase storage bucket name' as description,
      updated_at
    FROM settings
    WHERE storage_bucket IS NOT NULL

    UNION ALL

    SELECT
      'pdf_to_drive' as setting_key,
      to_jsonb(pdf_to_drive) as setting_value,
      'Whether to upload PDFs to Google Drive' as description,
      updated_at
    FROM settings
    WHERE pdf_to_drive IS NOT NULL

    UNION ALL

    SELECT
      'non_pdf_to_storage' as setting_key,
      to_jsonb(non_pdf_to_storage) as setting_value,
      'Whether to upload non-PDF files to Supabase Storage' as description,
      updated_at
    FROM settings
    WHERE non_pdf_to_storage IS NOT NULL
    ON CONFLICT (setting_key) DO NOTHING;
  ELSE
    RAISE NOTICE 'Skipping settings migration; legacy settings table not found';
  END IF;
END $$;

-- Phase 5.3: Add default settings if not already present
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
  ('drive_folder_id', 'null'::jsonb, 'Google Drive folder ID for resource storage'),
  ('storage_bucket', '"resources"'::jsonb, 'Supabase storage bucket name'),
  ('pdf_to_drive', 'true'::jsonb, 'Whether to upload PDFs to Google Drive'),
  ('non_pdf_to_storage', 'true'::jsonb, 'Whether to upload non-PDF files to Supabase Storage'),
  ('max_file_size_mb', '50'::jsonb, 'Maximum file size for uploads in MB'),
  ('allowed_file_types', '["pdf","doc","docx","ppt","pptx","xls","xlsx","txt","jpg","jpeg","png"]'::jsonb, 'Allowed file types for upload')
ON CONFLICT (setting_key) DO NOTHING;

-- Phase 5.4: Create view for backwards compatibility
CREATE OR REPLACE VIEW settings_view AS
SELECT
  'singleton'::text as id,
  (SELECT setting_value::text FROM app_settings WHERE setting_key = 'drive_folder_id' LIMIT 1) as drive_folder_id,
  (SELECT setting_value::text FROM app_settings WHERE setting_key = 'storage_bucket' LIMIT 1) as storage_bucket,
  (SELECT (setting_value::text)::boolean FROM app_settings WHERE setting_key = 'pdf_to_drive' LIMIT 1) as pdf_to_drive,
  (SELECT (setting_value::text)::boolean FROM app_settings WHERE setting_key = 'non_pdf_to_storage' LIMIT 1) as non_pdf_to_storage,
  now() as updated_at
;

-- Phase 5.5: Create helper functions for settings management

-- Function to get setting value
CREATE OR REPLACE FUNCTION get_setting(setting_key_param text)
RETURNS jsonb AS $$
DECLARE
  setting_val jsonb;
BEGIN
  SELECT setting_value INTO setting_val
  FROM app_settings
  WHERE setting_key = setting_key_param;

  RETURN setting_val;
END;
$$ LANGUAGE plpgsql;

-- Function to get setting value as text
CREATE OR REPLACE FUNCTION get_setting_text(setting_key_param text)
RETURNS text AS $$
DECLARE
  setting_val jsonb;
BEGIN
  SELECT setting_value INTO setting_val
  FROM app_settings
  WHERE setting_key = setting_key_param;

  RETURN setting_val::text;
END;
$$ LANGUAGE plpgsql;

-- Function to get setting value as boolean
CREATE OR REPLACE FUNCTION get_setting_bool(setting_key_param text)
RETURNS boolean AS $$
DECLARE
  setting_val jsonb;
BEGIN
  SELECT setting_value INTO setting_val
  FROM app_settings
  WHERE setting_key = setting_key_param;

  RETURN (setting_val::text)::boolean;
END;
$$ LANGUAGE plpgsql;

-- Function to get setting value as integer
CREATE OR REPLACE FUNCTION get_setting_int(setting_key_param text)
RETURNS integer AS $$
DECLARE
  setting_val jsonb;
BEGIN
  SELECT setting_value INTO setting_val
  FROM app_settings
  WHERE setting_key = setting_key_param;

  RETURN (setting_val::text)::integer;
END;
$$ LANGUAGE plpgsql;

-- Function to update setting
CREATE OR REPLACE FUNCTION update_setting(
  setting_key_param text,
  setting_value_param jsonb,
  description_param text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO app_settings (setting_key, setting_value, description)
  VALUES (setting_key_param, setting_value_param, description_param)
  ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    description = COALESCE(EXCLUDED.description, app_settings.description);
END;
$$ LANGUAGE plpgsql;

-- Function to get all settings as key-value pairs
CREATE OR REPLACE FUNCTION get_all_settings()
RETURNS TABLE (
  setting_key text,
  setting_value jsonb,
  description text,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.setting_key,
    s.setting_value,
    s.description,
    s.updated_at
  FROM app_settings s
  ORDER BY s.setting_key;
END;
$$ LANGUAGE plpgsql;

-- Phase 5.6: Create settings validation function
CREATE OR REPLACE FUNCTION validate_setting_value(
  setting_key_param text,
  setting_value_param jsonb
)
RETURNS boolean AS $$
DECLARE
  is_valid boolean := true;
BEGIN
  -- Validate max_file_size_mb
  IF setting_key_param = 'max_file_size_mb' THEN
    IF (setting_value_param::text)::integer < 1 OR (setting_value_param::text)::integer > 500 THEN
      is_valid := false;
    END IF;
  END IF;

  -- Validate allowed_file_types
  IF setting_key_param = 'allowed_file_types' THEN
    -- Check if it's a valid JSON array
    IF jsonb_typeof(setting_value_param) != 'array' THEN
      is_valid := false;
    END IF;
  END IF;

  -- Add more validation rules as needed

  RETURN is_valid;
END;
$$ LANGUAGE plpgsql;

-- Phase 5.7: Update settings with validation
CREATE OR REPLACE FUNCTION update_setting_with_validation(
  setting_key_param text,
  setting_value_param jsonb,
  description_param text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  is_valid boolean;
BEGIN
  -- Validate the setting value
  SELECT validate_setting_value(setting_key_param, setting_value_param) INTO is_valid;

  IF is_valid THEN
    PERFORM update_setting(setting_key_param, setting_value_param, description_param);
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Phase 5.8: Verification queries
DO $$
DECLARE cnt bigint;
BEGIN
  RAISE NOTICE '=== MIGRATION 005 VERIFICATION ===';
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='settings') THEN
    SELECT COUNT(*) INTO cnt FROM settings;
    RAISE NOTICE 'Old settings entries: %', cnt;
  ELSE
    RAISE NOTICE 'Old settings entries: 0 (table not present)';
  END IF;
  SELECT COUNT(*) INTO cnt FROM app_settings;
  RAISE NOTICE 'New app_settings entries: %', cnt;
END $$;

-- Show all settings
DO $$
BEGIN
  RAISE NOTICE 'Current settings:';
  PERFORM 1 FROM get_all_settings() LIMIT 1;
END $$;

-- Test helper functions
DO $$
BEGIN
  RAISE NOTICE 'Test get_setting functions:';
  PERFORM get_setting_bool('pdf_to_drive');
  PERFORM get_setting_text('storage_bucket');
  PERFORM get_setting_int('max_file_size_mb');
END $$;

-- Verify backwards compatibility view
DO $$
BEGIN
  RAISE NOTICE 'Backwards compatibility view:';
  PERFORM 1 FROM settings_view LIMIT 1;
END $$;

COMMIT;

-- Post-migration notes:
-- 1. Update application code to use new helper functions:
--    - get_setting_bool('pdf_to_drive') instead of settings.pdf_to_drive
--    - update_setting('max_file_size_mb', '100'::jsonb)
-- 2. Use settings_view for gradual migration of existing queries
-- 3. Consider dropping old settings table after full verification
-- 4. Add more validation rules in validate_setting_value() as needed
-- 5. Update RLS policies to work with new settings table structure
