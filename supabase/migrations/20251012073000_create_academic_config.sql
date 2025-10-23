-- Migration: Create academic_config table for dynamic academic settings
-- Safe to run multiple times; includes idempotent trigger and seed inserts.

BEGIN;

-- 1) Table
CREATE TABLE IF NOT EXISTS public.academic_config (
  config_key text PRIMARY KEY,
  config_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.academic_config IS 'Key-value store for academic program settings and year mappings';
COMMENT ON COLUMN public.academic_config.config_key IS 'Configuration key (e.g., program_settings, year_mappings)';
COMMENT ON COLUMN public.academic_config.config_value IS 'Configuration value stored as JSONB';

-- 2) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_academic_config_updated_at ON public.academic_config;
CREATE TRIGGER set_academic_config_updated_at
BEFORE UPDATE ON public.academic_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 3) Optional seed defaults (non-destructive)
INSERT INTO public.academic_config (config_key, config_value)
VALUES 
  (
    'program_settings',
    jsonb_build_object(
      'program_length', 4,
      'start_month', 6,
      'current_academic_year', EXTRACT(YEAR FROM CURRENT_DATE)::int
    )
  )
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO public.academic_config (config_key, config_value)
VALUES ('year_mappings', '{}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- 4) RLS configuration
-- Keep RLS enabled; the service role used by server-side code bypasses RLS.
ALTER TABLE public.academic_config ENABLE ROW LEVEL SECURITY;

-- If you ever want authenticated clients to read config (not required by current code),
-- you may add a read policy like below:
-- CREATE POLICY read_academic_config
--   ON public.academic_config
--   FOR SELECT
--   TO authenticated
--   USING (true);

COMMIT;