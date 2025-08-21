CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid

-- Admin roles enum
DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('admin', 'superadmin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- User roles enum (for profiles)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student','admin','superadmin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Branch enum (simple approach; alternatively use lookup table)
DO $$ BEGIN
  CREATE TYPE branch_type AS ENUM ('CSE','AIML','DS','AI','ECE','EEE','MEC','CE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role admin_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Settings singleton
CREATE TABLE IF NOT EXISTS settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  drive_folder_id text,
  storage_bucket text NOT NULL DEFAULT 'resources',
  pdf_to_drive boolean NOT NULL DEFAULT true,
  non_pdf_to_storage boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  actor_email text NOT NULL,
  actor_role admin_role NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  success boolean NOT NULL DEFAULT true,
  message text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Resources (create if missing; then extend columns additively for existing installs)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  unit INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  date TIMESTAMP NOT NULL DEFAULT NOW(),
  type TEXT,
  url TEXT NOT NULL,
  is_pdf BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Additive evolutions for resources
ALTER TABLE resources ADD COLUMN IF NOT EXISTS year SMALLINT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS branch branch_type;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS semester SMALLINT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS regulation TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE resources ALTER COLUMN date SET DEFAULT NOW();
-- type used to be NOT NULL; relax to NULLABLE if needed
DO $$ BEGIN
  ALTER TABLE resources ALTER COLUMN type DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  description TEXT,
  icon_type TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS year SMALLINT;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS branch branch_type;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Recent Updates
CREATE TABLE IF NOT EXISTS recent_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  date DATE,
  description TEXT,
  year SMALLINT,
  branch branch_type,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
-- Migrate existing recent_updates.date from TEXT to DATE if needed
DO $$ BEGIN
  ALTER TABLE recent_updates ALTER COLUMN date TYPE DATE USING (date::date);
EXCEPTION WHEN others THEN NULL; END $$;

-- Exams
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  exam_date DATE NOT NULL,
  description TEXT,
  year SMALLINT,
  branch branch_type,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at timestamptz
);

INSERT INTO storage.buckets (id, name, public) VALUES ('resources', 'resources', true) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_subject ON resources(subject);
CREATE INDEX IF NOT EXISTS idx_resources_unit ON resources(unit);
CREATE INDEX IF NOT EXISTS idx_resources_date ON resources(date DESC);
CREATE INDEX IF NOT EXISTS idx_resources_archived ON resources(archived);
CREATE INDEX IF NOT EXISTS idx_resources_year ON resources(year);
CREATE INDEX IF NOT EXISTS idx_resources_semester ON resources(semester);
CREATE INDEX IF NOT EXISTS idx_resources_year_semester ON resources(year, semester);
CREATE INDEX IF NOT EXISTS idx_resources_branch ON resources(branch);
CREATE INDEX IF NOT EXISTS idx_resources_year_branch ON resources(year, branch);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_year_branch ON reminders(year, branch);
CREATE INDEX IF NOT EXISTS idx_recent_updates_created_at ON recent_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_updates_year_branch ON recent_updates(year, branch);
CREATE INDEX IF NOT EXISTS idx_exams_exam_date ON exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_exams_year_branch ON exams(year, branch);

-- RLS enable (admin APIs will use service role)
DO $$ BEGIN EXECUTE 'ALTER TABLE admins ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE settings ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE resources ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE reminders ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE recent_updates ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE exams ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;

-- Optional FKs for audit actor and created_by on domain tables
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid;
DO $$ BEGIN
  ALTER TABLE audit_logs
  ADD CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES admins(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE resources ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE recent_updates ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT fk_resources_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE reminders ADD CONSTRAINT fk_reminders_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE recent_updates ADD CONSTRAINT fk_recent_updates_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE exams ADD CONSTRAINT fk_exams_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles table for user onboarding
-- Enum branch_type already created above; reuse it here

-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  year smallint NOT NULL CHECK (year BETWEEN 1 AND 4),
  branch branch_type NOT NULL,
  roll_number text NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger function (idempotent via CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles.updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS enable (admin APIs will use service role)
DO $$ BEGIN EXECUTE 'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN others THEN NULL; END $$;

-- Scopes for admins to restrict which year+branch they can manage
CREATE TABLE IF NOT EXISTS admin_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  year smallint NOT NULL CHECK (year BETWEEN 1 AND 4),
  branch branch_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, year, branch)
);

CREATE INDEX IF NOT EXISTS idx_admin_scopes_admin ON admin_scopes(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_scopes_ctx ON admin_scopes(year, branch);

-- Domain taxonomy for subjects/regulations/offerings/templates

-- Regulations (e.g., 'R23')
CREATE TABLE IF NOT EXISTS regulations (
  code text PRIMARY KEY,
  effective_year smallint,
  notes text
);

-- Resource type enum for subjects
DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM ('resources', 'records');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Canonical subject catalog
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, -- lowercase key used in URLs/resources.subject
  name text NOT NULL,
  full_name text,
  default_units smallint NOT NULL DEFAULT 5,
  resource_type resource_type NOT NULL DEFAULT 'resources',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Offerings of a subject for a regulation/branch/year/semester
CREATE TABLE IF NOT EXISTS subject_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation text NOT NULL REFERENCES regulations(code) ON DELETE CASCADE,
  branch branch_type NOT NULL,
  year smallint NOT NULL CHECK (year BETWEEN 1 AND 4),
  semester smallint NOT NULL CHECK (semester IN (1,2)),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  display_order smallint,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regulation, branch, year, semester, subject_id)
);

-- Templates for Record unit names (e.g., Week 1..4) scoped by context
CREATE TABLE IF NOT EXISTS record_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation text REFERENCES regulations(code) ON DELETE CASCADE,
  branch branch_type,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  year smallint,
  semester smallint,
  names text[] NOT NULL DEFAULT ARRAY['Week 1','Week 2','Week 3','Week 4'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    COALESCE(regulation,''),
    COALESCE((branch::text),'') ,
    COALESCE((subject_id::text),''),
    COALESCE((year::text),''),
    COALESCE((semester::text),'')
  )
);

-- Templates for Paper types (e.g., Mid-1, Mid-2, Sem, Prev)
CREATE TABLE IF NOT EXISTS paper_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation text REFERENCES regulations(code) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  names text[] NOT NULL DEFAULT ARRAY['Mid-1','Mid-2','Sem','Prev'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (COALESCE(regulation,''), COALESCE((subject_id::text),''))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_subject_offerings_context
  ON subject_offerings(regulation, branch, year, semester);
CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code);
CREATE INDEX IF NOT EXISTS idx_subjects_resource_type ON subjects(resource_type);