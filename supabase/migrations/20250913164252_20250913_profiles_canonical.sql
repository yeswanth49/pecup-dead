-- Stage A: Make profiles canonical, backfill, and prepare for dropping students/admins
-- Environment: dev first

BEGIN;

-- 1) Ensure email NOT NULL and UNIQUE (case-insensitive) on profiles
ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_email_ci ON profiles (lower(email));

-- 2) Add academic columns to profiles if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_id uuid   REFERENCES years(id) ON DELETE RESTRICT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES semesters(id) ON DELETE RESTRICT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roll_number text;
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_roll_number ON profiles (roll_number) WHERE roll_number IS NOT NULL;

-- 3) Backfill academic fields from students by email (if students exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students'
  ) THEN
    UPDATE profiles p SET
      branch_id   = COALESCE(p.branch_id,   s.branch_id),
      year_id     = COALESCE(p.year_id,     s.year_id),
      semester_id = COALESCE(p.semester_id, s.semester_id),
      section     = COALESCE(p.section,     s.section),
      roll_number = COALESCE(p.roll_number, s.roll_number)
    FROM students s
    WHERE lower(p.email) = lower(s.email);
  END IF;
END
$$;

-- 4) Backfill roles from admins by email when missing or inconsistent (if admins exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admins'
  ) THEN
    -- Map admins.role (admin_role enum) into profiles.role (user_role enum)
    UPDATE profiles p
    SET role = CASE a.role
                 WHEN 'superadmin'::admin_role THEN 'superadmin'::user_role
                 ELSE 'admin'::user_role
               END
    FROM admins a
    WHERE lower(p.email) = lower(a.email)
      AND (p.role IS NULL OR p.role NOT IN ('admin'::user_role, 'superadmin'::user_role));
  END IF;
END
$$;

-- Drop legacy FKs referencing admins/students prior to remapping
ALTER TABLE IF EXISTS resources       DROP CONSTRAINT IF EXISTS fk_resources_created_by;
ALTER TABLE IF EXISTS resources       DROP CONSTRAINT IF EXISTS fk_resources_uploader;
ALTER TABLE IF EXISTS exams           DROP CONSTRAINT IF EXISTS fk_exams_created_by;
ALTER TABLE IF EXISTS recent_updates  DROP CONSTRAINT IF EXISTS fk_recent_updates_created_by;
ALTER TABLE IF EXISTS reminders       DROP CONSTRAINT IF EXISTS fk_reminders_created_by;
ALTER TABLE IF EXISTS audit_logs      DROP CONSTRAINT IF EXISTS fk_audit_logs_actor;
ALTER TABLE IF EXISTS academic_calendar DROP CONSTRAINT IF EXISTS academic_calendar_updated_by_fkey;

-- 5) Optional: Migrate resources.created_by away from admins/students to profiles.id if column exists
--    This is a best-effort update; the column may not exist in current schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='resources' AND column_name='created_by'
  ) THEN
    -- If created_by currently stores admins.id or profiles.id, try to normalize to profiles.id by email
    UPDATE resources r SET created_by = p.id
    FROM profiles p
    WHERE r.created_by IS NOT NULL
      AND (
        -- created_by already a profiles.id
        p.id = r.created_by OR
        -- or map via email from admins/students tables if present
        (
          EXISTS (SELECT 1 FROM admins a WHERE a.id = r.created_by AND lower(a.email) = lower(p.email)) OR
          EXISTS (SELECT 1 FROM students s WHERE s.id = r.created_by AND lower(s.email) = lower(p.email))
        )
      );
  END IF;
END
$$;

-- Remap other references from admins/students to profiles
-- resources.uploader_id: students -> profiles by email, or NULL if no match
UPDATE resources r SET uploader_id = p.id
FROM students s JOIN profiles p ON lower(s.email) = lower(p.email)
WHERE r.uploader_id = s.id;
UPDATE resources r SET uploader_id = NULL
WHERE r.uploader_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.uploader_id);

-- exams.created_by: admins -> profiles by email, or NULL
UPDATE exams e SET created_by = p.id
FROM admins a JOIN profiles p ON lower(a.email) = lower(p.email)
WHERE e.created_by = a.id;
UPDATE exams e SET created_by = NULL
WHERE e.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = e.created_by);

-- recent_updates.created_by: admins -> profiles by email, or NULL
UPDATE recent_updates ru SET created_by = p.id
FROM admins a JOIN profiles p ON lower(a.email) = lower(p.email)
WHERE ru.created_by = a.id;
UPDATE recent_updates ru SET created_by = NULL
WHERE ru.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ru.created_by);

-- reminders.created_by: admins -> profiles by email, or NULL
UPDATE reminders r SET created_by = p.id
FROM admins a JOIN profiles p ON lower(a.email) = lower(p.email)
WHERE r.created_by = a.id;
UPDATE reminders r SET created_by = NULL
WHERE r.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.created_by);

-- audit_logs.actor_id: map by actor_email
UPDATE audit_logs al SET actor_id = p.id
FROM profiles p
WHERE al.actor_email IS NOT NULL AND lower(al.actor_email) = lower(p.email);
UPDATE audit_logs al SET actor_id = NULL
WHERE al.actor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = al.actor_id);

-- academic_calendar.updated_by: set NULL if pointing to admins
UPDATE academic_calendar ac SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND EXISTS (SELECT 1 FROM admins a WHERE a.id = ac.updated_by);

COMMIT;

-- Rollback notes (manual):
-- - DROP INDEX IF EXISTS ux_profiles_email_ci;
-- - DROP INDEX IF EXISTS ux_profiles_roll_number;
-- - ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL; -- if needed
-- - ALTER TABLE profiles DROP COLUMN IF EXISTS branch_id, DROP COLUMN IF EXISTS year_id, DROP COLUMN IF EXISTS semester_id, DROP COLUMN IF EXISTS section, DROP COLUMN IF EXISTS roll_number;

-- 6) Update admin_scopes to reference profiles.id (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_scopes'
  ) THEN
    -- Drop possible existing FK to admins
    BEGIN
      EXECUTE 'ALTER TABLE admin_scopes DROP CONSTRAINT IF EXISTS admin_scopes_admin_id_fkey';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Backfill admin_scopes.admin_id to profiles.id using admins->profiles mapping if admins exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='admins'
    ) THEN
      UPDATE admin_scopes sc SET admin_id = p.id
      FROM admins a
      JOIN profiles p ON lower(p.email) = lower(a.email)
      WHERE sc.admin_id = a.id;
    END IF;

    -- Add FK to profiles
    BEGIN
      EXECUTE 'ALTER TABLE admin_scopes ADD CONSTRAINT admin_scopes_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END
$$;

-- 7) Update FKs to reference profiles instead of admins/students where needed
-- resources.created_by -> profiles(id)
ALTER TABLE IF EXISTS resources DROP CONSTRAINT IF EXISTS fk_resources_created_by;
ALTER TABLE IF EXISTS resources ADD CONSTRAINT fk_resources_created_by_profiles
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- resources.uploader_id -> profiles(id)
ALTER TABLE IF EXISTS resources DROP CONSTRAINT IF EXISTS fk_resources_uploader;
ALTER TABLE IF EXISTS resources ADD CONSTRAINT fk_resources_uploader_profiles
  FOREIGN KEY (uploader_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- exams.created_by -> profiles(id)
ALTER TABLE IF EXISTS exams DROP CONSTRAINT IF EXISTS fk_exams_created_by;
ALTER TABLE IF EXISTS exams ADD CONSTRAINT fk_exams_created_by_profiles
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- recent_updates.created_by -> profiles(id)
ALTER TABLE IF EXISTS recent_updates DROP CONSTRAINT IF EXISTS fk_recent_updates_created_by;
ALTER TABLE IF EXISTS recent_updates ADD CONSTRAINT fk_recent_updates_created_by_profiles
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- reminders.created_by -> profiles(id)
ALTER TABLE IF EXISTS reminders DROP CONSTRAINT IF EXISTS fk_reminders_created_by;
ALTER TABLE IF EXISTS reminders ADD CONSTRAINT fk_reminders_created_by_profiles
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- audit_logs.actor_id -> profiles(id)
ALTER TABLE IF EXISTS audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_actor;
ALTER TABLE IF EXISTS audit_logs ADD CONSTRAINT fk_audit_logs_actor_profiles
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- academic_calendar.updated_by -> profiles(id)
ALTER TABLE IF EXISTS academic_calendar DROP CONSTRAINT IF EXISTS academic_calendar_updated_by_fkey;
ALTER TABLE IF EXISTS academic_calendar ADD CONSTRAINT academic_calendar_updated_by_profiles_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

