-- Migration: Create hero_texts table for dynamic hero section texts
-- Includes priority ordering and time limit support (1 day or undefined)

BEGIN;

-- 1) updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Table
CREATE TABLE IF NOT EXISTS public.hero_texts (
  id serial PRIMARY KEY,
  text text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  time_limit timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hero_texts IS 'Dynamic texts for hero section with priority and time limit';
COMMENT ON COLUMN public.hero_texts.text IS 'The hero text content';
COMMENT ON COLUMN public.hero_texts.priority IS 'Priority order (lower number = higher priority)';
COMMENT ON COLUMN public.hero_texts.time_limit IS 'Expiration timestamp, null for no time limit';

-- 3) updated_at trigger
DROP TRIGGER IF EXISTS set_hero_texts_updated_at ON public.hero_texts;
CREATE TRIGGER set_hero_texts_updated_at
BEFORE UPDATE ON public.hero_texts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 4) Seed with existing texts
INSERT INTO public.hero_texts (text, priority, time_limit) VALUES
  ('New, way to access PEC.UP : starBOT', 1, NULL),
  ('Ready for Mid-2?', 2, NULL),
  ('Bored with studies? Not anymore!', 3, NULL),
  ('resources that are actually useful', 4, NULL),
  ('Made for students, by students!', 5, NULL);
  -- Example time-limited texts (commented out - uncomment to test)
  -- ('2-hour special message!', 0, now() + interval '2 hours'),
  -- ('Daily reminder', 0, now() + interval '1 day'),
  -- ('Weekly announcement', 0, now() + interval '1 week'),
  -- ('Until December 15th 2025', 0, '2025-12-15 00:00:00+05:30');

-- 5) RLS configuration
ALTER TABLE public.hero_texts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (for client-side fetching)
DROP POLICY IF EXISTS read_hero_texts ON public.hero_texts;
CREATE POLICY read_hero_texts
  ON public.hero_texts
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;