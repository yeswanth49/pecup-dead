-- Migration: Add representative role to user permissions system
-- This migration adds the 'representative' role to support the three-tier permission system:
-- student: read-only access
-- representative: can add/remove resources for their branch+year, can promote to next semester
-- admin: can manage all resources across all branches and years

-- Add 'representative' to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'representative';

-- Update profiles table to ensure role field exists with proper default
-- (This should already exist, but ensuring compatibility)
DO $$ BEGIN
  -- Check if role column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role user_role NOT NULL DEFAULT 'student';
  END IF;
END $$;

-- Create representatives table to track representative assignments
-- This allows multiple representatives per branch/year and tracks their permissions
CREATE TABLE IF NOT EXISTS representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, branch_id, year_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_representatives_user ON representatives(user_id);
CREATE INDEX IF NOT EXISTS idx_representatives_branch_year ON representatives(branch_id, year_id);
CREATE INDEX IF NOT EXISTS idx_representatives_active ON representatives(active);

-- Add semester promotion tracking table
CREATE TABLE IF NOT EXISTS semester_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promoted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  to_semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  promotion_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for semester promotion tracking
CREATE INDEX IF NOT EXISTS idx_semester_promotions_promoted_by ON semester_promotions(promoted_by);
CREATE INDEX IF NOT EXISTS idx_semester_promotions_date ON semester_promotions(promotion_date);

-- Update RLS policies for new role system

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admin read access" ON profiles;
DROP POLICY IF EXISTS "Admin write access" ON profiles;

-- Create new RLS policies for profiles table
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (
  email = auth.jwt() ->> 'email'
);

CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);

CREATE POLICY "Admins can modify all profiles" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);

-- RLS policies for representatives table
ALTER TABLE representatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Representatives can view their assignments" ON representatives FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND email = auth.jwt() ->> 'email')
);

CREATE POLICY "Admins can manage representatives" ON representatives FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);

-- RLS policies for semester_promotions table
ALTER TABLE semester_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view promotions they performed" ON semester_promotions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = promoted_by AND email = auth.jwt() ->> 'email')
);

CREATE POLICY "Admins can view all promotions" ON semester_promotions FOR SELECT USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);

CREATE POLICY "Representatives and admins can create promotions" ON semester_promotions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = promoted_by 
    AND p.email = auth.jwt() ->> 'email'
    AND (
      p.role IN ('admin', 'superadmin') OR
      (p.role = 'representative' AND EXISTS (
        SELECT 1 FROM representatives r 
        WHERE r.user_id = p.id 
        AND r.branch_id = semester_promotions.branch_id 
        AND r.year_id = semester_promotions.year_id 
        AND r.active = true
      ))
    )
  )
);

-- Update resources table RLS policies to support representatives
DROP POLICY IF EXISTS "Public read access" ON resources;
DROP POLICY IF EXISTS "Admin write access" ON resources;

-- Students and representatives can read resources for their branch/year
CREATE POLICY "Users can view relevant resources" ON resources FOR SELECT USING (
  -- Public read for now, can be restricted later based on user context
  true
);

-- Representatives can manage resources for their assigned branch/year
CREATE POLICY "Representatives can manage their resources" ON resources FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.email = auth.jwt() ->> 'email'
    AND (
      -- Admins can manage all resources
      p.role IN ('admin', 'superadmin') OR
      -- Representatives can manage resources for their assigned branch/year
      (p.role = 'representative' AND EXISTS (
        SELECT 1 FROM representatives r
        WHERE r.user_id = p.id
        AND r.branch_id = resources.branch_id
        AND r.year_id = resources.year_id
        AND r.active = true
      ))
    )
  )
);

-- Similar policies for other content tables (reminders, recent_updates, exams)
-- Update reminders RLS
DROP POLICY IF EXISTS "Public read access" ON reminders;
DROP POLICY IF EXISTS "Admin write access" ON reminders;

CREATE POLICY "Users can view relevant reminders" ON reminders FOR SELECT USING (true);

CREATE POLICY "Representatives and admins can manage reminders" ON reminders FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.email = auth.jwt() ->> 'email'
    AND (
      p.role IN ('admin', 'superadmin') OR
      (p.role = 'representative' AND (
        -- Representatives can manage reminders for their branch/year
        (reminders.branch IS NULL OR EXISTS (
          SELECT 1 FROM representatives r
          JOIN branches b ON r.branch_id = b.id
          WHERE r.user_id = p.id AND b.code::text = reminders.branch::text AND r.active = true
        )) AND
        (reminders.year IS NULL OR EXISTS (
          SELECT 1 FROM representatives r
          JOIN years y ON r.year_id = y.id
          WHERE r.user_id = p.id AND y.batch_year = reminders.year AND r.active = true
        ))
      ))
    )
  )
);

-- Update recent_updates RLS
DROP POLICY IF EXISTS "Public read access" ON recent_updates;
DROP POLICY IF EXISTS "Admin write access" ON recent_updates;

CREATE POLICY "Users can view relevant updates" ON recent_updates FOR SELECT USING (true);

CREATE POLICY "Representatives and admins can manage updates" ON recent_updates FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.email = auth.jwt() ->> 'email'
    AND (
      p.role IN ('admin', 'superadmin') OR
      (p.role = 'representative' AND (
        -- Representatives can manage updates for their branch/year
        (recent_updates.branch IS NULL OR EXISTS (
          SELECT 1 FROM representatives r
          JOIN branches b ON r.branch_id = b.id
          WHERE r.user_id = p.id AND b.code::text = recent_updates.branch::text AND r.active = true
        )) AND
        (recent_updates.year IS NULL OR EXISTS (
          SELECT 1 FROM representatives r
          JOIN years y ON r.year_id = y.id
          WHERE r.user_id = p.id AND y.batch_year = recent_updates.year AND r.active = true
        ))
      ))
    )
  )
);

-- Update exams RLS
DROP POLICY IF EXISTS "Public read access" ON exams;
DROP POLICY IF EXISTS "Admin write access" ON exams;

CREATE POLICY "Users can view relevant exams" ON exams FOR SELECT USING (true);

CREATE POLICY "Representatives and admins can manage exams" ON exams FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.email = auth.jwt() ->> 'email'
    AND (
      p.role IN ('admin', 'superadmin') OR
      (p.role = 'representative' AND (
        -- Representatives can manage exams for their branch/year
        (exams.branch IS NULL OR EXISTS (
          SELECT 1 FROM representatives r
          JOIN branches b ON r.branch_id = b.id
          WHERE r.user_id = p.id AND b.code::text = exams.branch::text AND r.active = true
        )) AND
        (exams.year IS NULL OR EXISTS (
          SELECT 1 FROM representatives r
          JOIN years y ON r.year_id = y.id
          WHERE r.user_id = p.id AND y.batch_year = exams.year AND r.active = true
        ))
      ))
    )
  )
);

COMMENT ON TABLE representatives IS 'Tracks users assigned as representatives for specific branch/year combinations';
COMMENT ON TABLE semester_promotions IS 'Tracks semester promotions performed by representatives and admins';
