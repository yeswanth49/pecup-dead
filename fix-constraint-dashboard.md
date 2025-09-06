# Fix Semester Constraint - Supabase Dashboard

## Step 1: Open Supabase Dashboard
Go to: **https://supabase.com/dashboard/project/hynugyyfidoxapjmmahd/sql**

## Step 2: Execute Constraint Fix
Copy and paste this SQL into the editor and click **"Run"**:

```sql
-- Drop the restrictive check constraint
ALTER TABLE semesters DROP CONSTRAINT IF EXISTS semesters_semester_number_check;

-- Verify the constraint is gone
SELECT conname, contype, conrelid::regclass, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'semesters'::regclass
AND contype = 'c';
```

## Step 3: Expected Result
You should see:
- ✅ Success message for the ALTER TABLE
- Empty result set (no constraints found) for the verification query

## Step 4: Run Migrations
Once the constraint is dropped, run the migrations again:

```bash
cd /Users/yeswanth/Documents/pecup-dead
supabase db push --include-all
```

## Alternative: Manual Migration Execution

If you prefer to run each migration manually:

### Migration 002 Fix
After dropping the constraint, run migration 002:

```sql
-- This is the content of migrations/002_enhance_branches_years_semesters.sql
-- Copy and paste the entire file content here and run it
```

### Continue with Other Migrations
Then run the remaining migrations in order:
- Migration 003
- Migration 004
- Migration 005
- Migration 006
- Migration 007

## What This Fixes

The restrictive check constraint `semesters_semester_number_check` only allows semester numbers 1 and 2. This migration needs to support 8 semesters per academic year (1-8).

**Before:** `semester_number IN (1, 2)` ❌
**After:** No constraint - flexible semester numbering ✅

## Troubleshooting

If you get an error about permissions:
```sql
-- Grant necessary permissions (run as admin)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
```

**Ready to drop the constraint?** Go to the Supabase Dashboard and execute the fix! 🚀




