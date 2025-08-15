# Database Schema Refactoring Guide

## Overview

This document provides a step-by-step plan to refactor the current database schema to match the target multi-year, multi-branch academic resource hub design with admin-controlled semester progression.

## Target Schema Goals

Transform from the current ENUM-based approach to a normalized lookup table design with proper foreign key relationships and centralized academic calendar management.

## Migration Strategy

This refactoring will be done in phases to ensure data integrity and minimize downtime. All migrations are designed to be reversible and preserve existing data.

---

## Phase 1: Create New Lookup Tables

### Step 1.1: Create `branches` table

```sql
-- Create branches lookup table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Migrate existing branch enum values
INSERT INTO branches (name, code) VALUES
  ('Computer Science Engineering', 'CSE'),
  ('Artificial Intelligence & Machine Learning', 'AIML'),
  ('Data Science', 'DS'),
  ('Artificial Intelligence', 'AI'),
  ('Electronics & Communication Engineering', 'ECE'),
  ('Electrical & Electronics Engineering', 'EEE'),
  ('Mechanical Engineering', 'MEC'),
  ('Civil Engineering', 'CE')
ON CONFLICT (code) DO NOTHING;
```

### Step 1.2: Create `years` table

```sql
-- Create years lookup table
CREATE TABLE IF NOT EXISTS years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_year integer NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert current academic years (adjust as needed)
INSERT INTO years (batch_year, display_name) VALUES
  (2024, '2024-25 Batch'),
  (2023, '2023-24 Batch'),
  (2022, '2022-23 Batch'),
  (2021, '2021-22 Batch')
ON CONFLICT (batch_year) DO NOTHING;
```

### Step 1.3: Create `semesters` table

```sql
-- Create semesters lookup table
CREATE TABLE IF NOT EXISTS semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_number integer NOT NULL CHECK (semester_number IN (1, 2)),
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semester_number, year_id)
);

-- Populate semesters for each year
INSERT INTO semesters (semester_number, year_id)
SELECT 
  sem.semester_number,
  y.id as year_id
FROM years y
CROSS JOIN (VALUES (1), (2)) AS sem(semester_number)
ON CONFLICT (semester_number, year_id) DO NOTHING;
```

### Step 1.4: Create `academic_calendar` table

```sql
-- Create academic calendar for semester progression control
CREATE TABLE IF NOT EXISTS academic_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_year_id uuid NOT NULL REFERENCES years(id) ON DELETE RESTRICT,
  current_semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
  last_updated timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES admins(id) ON DELETE SET NULL
);

-- Set initial academic calendar (adjust current year/semester as needed)
INSERT INTO academic_calendar (current_year_id, current_semester_id)
SELECT 
  y.id as current_year_id,
  s.id as current_semester_id
FROM years y
JOIN semesters s ON s.year_id = y.id
WHERE y.batch_year = 2024 AND s.semester_number = 1
ON CONFLICT DO NOTHING;

-- Ensure singleton pattern
ALTER TABLE academic_calendar ADD CONSTRAINT academic_calendar_singleton 
CHECK (id = gen_random_uuid()) DEFERRABLE INITIALLY DEFERRED;
```

---

## Phase 2: Create New `students` Table

### Step 2.1: Create `students` table with proper relationships

```sql
-- Create students table to replace profiles for student-specific data
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE RESTRICT,
  semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
  section text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_year ON students(year_id);
CREATE INDEX IF NOT EXISTS idx_students_semester ON students(semester_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Step 2.2: Migrate data from `profiles` to `students`

```sql
-- Migration script to populate students from existing profiles
INSERT INTO students (
  roll_number, 
  name, 
  email,
  branch_id, 
  year_id, 
  semester_id,
  section,
  created_at,
  updated_at
)
SELECT 
  p.roll_number,
  p.name,
  p.email,
  b.id as branch_id,
  y.id as year_id,
  s.id as semester_id,
  NULL as section, -- Will need to be populated separately
  p.created_at,
  p.updated_at
FROM profiles p
JOIN branches b ON b.code = p.branch::text
JOIN years y ON y.batch_year = (
  CASE 
    WHEN p.year = 1 THEN 2024
    WHEN p.year = 2 THEN 2023
    WHEN p.year = 3 THEN 2022
    WHEN p.year = 4 THEN 2021
    ELSE 2024
  END
)
JOIN semesters s ON s.year_id = y.id AND s.semester_number = 1 -- Default to semester 1
WHERE p.role = 'student'
ON CONFLICT (roll_number) DO NOTHING;
```

---

## Phase 3: Add New Columns to `resources` Table

### Step 3.1: Add new foreign key columns

```sql
-- Add new columns to resources table
ALTER TABLE resources ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS drive_link text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS year_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS semester_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS uploader_id uuid;

-- Add foreign key constraints
ALTER TABLE resources ADD CONSTRAINT fk_resources_branch 
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE resources ADD CONSTRAINT fk_resources_year 
  FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE RESTRICT;
ALTER TABLE resources ADD CONSTRAINT fk_resources_semester 
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE RESTRICT;
ALTER TABLE resources ADD CONSTRAINT fk_resources_uploader 
  FOREIGN KEY (uploader_id) REFERENCES students(id) ON DELETE SET NULL;
```

### Step 3.2: Migrate existing data to new columns

```sql
-- Migrate existing resource data to new structure
UPDATE resources SET 
  title = name,
  drive_link = url,
  file_type = COALESCE(type, 'unknown'),
  branch_id = (SELECT id FROM branches WHERE code = resources.branch::text),
  year_id = (SELECT id FROM years WHERE batch_year = 
    CASE 
      WHEN resources.year = 1 THEN 2024
      WHEN resources.year = 2 THEN 2023
      WHEN resources.year = 3 THEN 2022
      WHEN resources.year = 4 THEN 2021
      ELSE 2024
    END
  ),
  semester_id = (
    SELECT s.id FROM semesters s 
    JOIN years y ON s.year_id = y.id 
    WHERE s.semester_number = COALESCE(resources.semester, 1)
    AND y.batch_year = 
      CASE 
        WHEN resources.year = 1 THEN 2024
        WHEN resources.year = 2 THEN 2023
        WHEN resources.year = 3 THEN 2022
        WHEN resources.year = 4 THEN 2021
        ELSE 2024
      END
  )
WHERE title IS NULL OR drive_link IS NULL OR file_type IS NULL 
   OR branch_id IS NULL OR year_id IS NULL OR semester_id IS NULL;

-- Note: uploader_id will remain NULL since current resources are admin-uploaded
-- Future resources will be student-uploaded
```

---

## Phase 4: Data Validation and Cleanup

### Step 4.1: Validate data integrity

```sql
-- Check for any resources without proper foreign key references
SELECT 
  COUNT(*) as total_resources,
  COUNT(branch_id) as with_branch,
  COUNT(year_id) as with_year,
  COUNT(semester_id) as with_semester,
  COUNT(uploader_id) as with_uploader
FROM resources;

-- Check for orphaned references
SELECT 'branches' as table_name, COUNT(*) as orphaned
FROM resources r LEFT JOIN branches b ON r.branch_id = b.id WHERE r.branch_id IS NOT NULL AND b.id IS NULL
UNION ALL
SELECT 'years', COUNT(*)
FROM resources r LEFT JOIN years y ON r.year_id = y.id WHERE r.year_id IS NOT NULL AND y.id IS NULL
UNION ALL
SELECT 'semesters', COUNT(*)
FROM resources r LEFT JOIN semesters s ON r.semester_id = s.id WHERE r.semester_id IS NOT NULL AND s.id IS NULL
UNION ALL
SELECT 'students', COUNT(*)
FROM resources r LEFT JOIN students st ON r.uploader_id = st.id WHERE r.uploader_id IS NOT NULL AND st.id IS NULL;
```

### Step 4.2: Make new columns required

```sql
-- After validating data, make the new columns NOT NULL
ALTER TABLE resources ALTER COLUMN title SET NOT NULL;
ALTER TABLE resources ALTER COLUMN drive_link SET NOT NULL;
ALTER TABLE resources ALTER COLUMN file_type SET NOT NULL;
ALTER TABLE resources ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE resources ALTER COLUMN year_id SET NOT NULL;
ALTER TABLE resources ALTER COLUMN semester_id SET NOT NULL;
-- Note: uploader_id remains nullable for admin-uploaded resources
```

---

## Phase 5: Remove Old Columns and Constraints

### Step 5.1: Create backup before dropping columns

```sql
-- Create backup table with old structure
CREATE TABLE resources_backup AS SELECT * FROM resources;
```

### Step 5.2: Drop old columns (after ensuring new system works)

```sql
-- Drop old columns that are no longer needed
ALTER TABLE resources DROP COLUMN IF EXISTS name;
ALTER TABLE resources DROP COLUMN IF EXISTS url;
ALTER TABLE resources DROP COLUMN IF EXISTS type;
ALTER TABLE resources DROP COLUMN IF EXISTS branch;
ALTER TABLE resources DROP COLUMN IF EXISTS year;
ALTER TABLE resources DROP COLUMN IF EXISTS semester;
ALTER TABLE resources DROP COLUMN IF EXISTS created_by; -- Replaced by uploader_id

-- Optional: Remove columns that don't fit the target schema
-- ALTER TABLE resources DROP COLUMN IF EXISTS category;
-- ALTER TABLE resources DROP COLUMN IF EXISTS subject;
-- ALTER TABLE resources DROP COLUMN IF EXISTS unit;
-- ALTER TABLE resources DROP COLUMN IF EXISTS date;
-- ALTER TABLE resources DROP COLUMN IF EXISTS is_pdf;
-- ALTER TABLE resources DROP COLUMN IF EXISTS regulation;
-- ALTER TABLE resources DROP COLUMN IF EXISTS archived;
-- ALTER TABLE resources DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE resources DROP COLUMN IF EXISTS updated_at;
```

---

## Phase 6: Update Application Code

### Step 6.1: Update TypeScript types

Create new type definitions in `lib/types.ts`:

```typescript
export interface Branch {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Year {
  id: string;
  batch_year: number;
  display_name: string;
  created_at: string;
}

export interface Semester {
  id: string;
  semester_number: number;
  year_id: string;
  created_at: string;
  year?: Year;
}

export interface Student {
  id: string;
  roll_number: string;
  name: string;
  email: string;
  branch_id: string;
  year_id: string;
  semester_id: string;
  section?: string;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  year?: Year;
  semester?: Semester;
}

export interface Resource {
  id: string;
  title: string;
  description?: string;
  drive_link: string;
  file_type: string;
  branch_id: string;
  year_id: string;
  semester_id: string;
  uploader_id?: string;
  created_at: string;
  branch?: Branch;
  year?: Year;
  semester?: Semester;
  uploader?: Student;
}

export interface AcademicCalendar {
  id: string;
  current_year_id: string;
  current_semester_id: string;
  last_updated: string;
  updated_by?: string;
  current_year?: Year;
  current_semester?: Semester;
}
```

### Step 6.2: Update API routes

Update existing API routes to use new schema:

- `app/api/resources/route.ts` - Update to use new foreign keys
- `app/api/profile/route.ts` - Update to work with students table
- `app/api/subjects/route.ts` - Update to use new relationships
- Create new routes:
  - `app/api/academic-calendar/route.ts` - Semester progression control
  - `app/api/branches/route.ts` - Branch management
  - `app/api/years/route.ts` - Year management
  - `app/api/students/route.ts` - Student management

### Step 6.3: Update UI components

Update components to work with new data structure:

- `components/ResourceUploadForm.tsx` - Use new foreign key selectors
- `app/(protected)/profile/page.tsx` - Work with students table
- `app/dev-dashboard/` - Update admin interfaces for new tables

---

## Phase 7: Enable Row Level Security (RLS)

### Step 7.1: Enable RLS on new tables

```sql
-- Enable RLS on new tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE years ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_calendar ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Branches: public read, admin write
CREATE POLICY "Public read access" ON branches FOR SELECT USING (true);
CREATE POLICY "Admin write access" ON branches FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);

-- Years: public read, admin write
CREATE POLICY "Public read access" ON years FOR SELECT USING (true);
CREATE POLICY "Admin write access" ON years FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);

-- Semesters: public read, admin write
CREATE POLICY "Public read access" ON semesters FOR SELECT USING (true);
CREATE POLICY "Admin write access" ON semesters FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);

-- Students: users can read their own data, admins can read all
CREATE POLICY "Users can view own profile" ON students FOR SELECT USING (
  email = auth.jwt() ->> 'email'
);
CREATE POLICY "Admin read access" ON students FOR SELECT USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);
CREATE POLICY "Admin write access" ON students FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email')
);

-- Academic calendar: public read, superadmin write
CREATE POLICY "Public read access" ON academic_calendar FOR SELECT USING (true);
CREATE POLICY "Superadmin write access" ON academic_calendar FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email' AND role = 'superadmin')
);
```

---

## Phase 8: Testing and Rollback Plan

### Step 8.1: Testing checklist

- [ ] All existing functionality works with new schema
- [ ] Resource upload/download works correctly
- [ ] User authentication and profile management works
- [ ] Admin dashboard functions properly
- [ ] Performance is acceptable with new foreign key joins
- [ ] RLS policies work as expected

### Step 8.2: Rollback plan

If issues arise, rollback can be performed by:

1. Restoring from `resources_backup` table
2. Dropping new tables: `students`, `branches`, `years`, `semesters`, `academic_calendar`
3. Reverting application code changes
4. Re-enabling old enum-based logic

### Step 8.3: Performance considerations

- Monitor query performance with new JOIN operations
- Consider adding materialized views for common queries
- Optimize indexes based on query patterns
- Consider caching strategies for lookup tables

---

## Phase 9: Post-Migration Tasks

### Step 9.1: Data cleanup

```sql
-- Remove backup table after successful migration
DROP TABLE IF EXISTS resources_backup;

-- Remove old enum types (after confirming not used)
-- DROP TYPE IF EXISTS branch_type;
```

### Step 9.2: Documentation updates

- Update API documentation
- Update database schema documentation
- Update deployment guides
- Update development setup instructions

### Step 9.3: Monitoring

- Set up monitoring for new tables
- Monitor foreign key constraint violations
- Track academic calendar usage
- Monitor student data accuracy

---

## Benefits of New Schema

1. **Normalized Design**: Proper foreign key relationships ensure data integrity
2. **Centralized Control**: Academic calendar allows admin-controlled semester progression
3. **Scalability**: Lookup tables allow easy addition of new branches/years
4. **Student-Centric**: Resources are linked to student uploaders, not just admins
5. **Data Integrity**: Foreign key constraints prevent orphaned data
6. **Flexibility**: Easy to add new academic periods, branches, or modify relationships

## Considerations

1. **Breaking Changes**: This is a major schema change requiring application updates
2. **Data Migration**: Careful mapping of existing enum values to lookup tables
3. **Performance**: New JOIN operations may impact query performance
4. **Complexity**: More complex schema requires more careful development practices
5. **Testing**: Extensive testing required due to fundamental schema changes

---

*This migration should be performed in a staging environment first and thoroughly tested before applying to production.*
