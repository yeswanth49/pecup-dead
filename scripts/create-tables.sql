CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid

-- Admin roles enum
DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('admin', 'superadmin');
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
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_recent_updates_created_at ON recent_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exams_exam_date ON exams(exam_date);

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