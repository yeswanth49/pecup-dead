# Database Refactoring Execution Guide

This guide provides step-by-step instructions for executing the database schema refactoring from ENUM-based design to normalized lookup tables.

## ⚠️ Important Prerequisites

- **Backup**: Ensure you have a complete backup of your current database
- **Environment**: This should be executed in a development environment first
- **Downtime**: This migration requires application downtime during execution
- **Testing**: Thoroughly test each phase before proceeding to the next

## Migration Files Overview

The refactoring is split into 8 phases, each with its own SQL file:

1. `database-refactor-phase1-lookup-tables.sql` - Create new lookup tables
2. `database-refactor-phase2-students-table.sql` - Create students table
3. `database-refactor-phase3-resources-migration.sql` - Migrate resources data
4. `database-refactor-phase4-data-validation.sql` - Validate and fix data
5. `database-refactor-phase5-cleanup-old-schema.sql` - Remove old columns
6. Updated application code files (`lib/types.ts`, new API routes)
7. `database-refactor-phase7-enable-rls.sql` - Enable Row Level Security
8. `database-refactor-phase8-testing.sql` - Comprehensive testing

## Execution Steps

### Phase 1: Create Lookup Tables

```bash
# Execute the first migration
psql -h your-supabase-host -U postgres -d postgres -f scripts/database-refactor-phase1-lookup-tables.sql
```

**Expected Results:**
- 8 branches created (CSE, AIML, DS, AI, ECE, EEE, MEC, CE)
- 4 academic years created (2024-25, 2023-24, 2022-23, 2021-22)
- 8 semesters created (2 per year)
- 1 academic calendar entry

**Verification:**
```sql
SELECT COUNT(*) FROM branches; -- Should be 8
SELECT COUNT(*) FROM years; -- Should be 4
SELECT COUNT(*) FROM semesters; -- Should be 8
SELECT COUNT(*) FROM academic_calendar; -- Should be 1
```

### Phase 2: Create Students Table

```bash
psql -h your-supabase-host -U postgres -d postgres -f scripts/database-refactor-phase2-students-table.sql
```

**Expected Results:**
- New `students` table created with foreign key relationships
- Data migrated from `profiles` table (if any student profiles exist)
- Proper indexing and triggers set up

**Verification:**
```sql
-- Check table structure
\d students

-- Check data migration (if you had student profiles)
SELECT COUNT(*) FROM students;
```

### Phase 3: Migrate Resources Data

```bash
psql -h your-supabase-host -U postgres -d postgres -f scripts/database-refactor-phase3-resources-migration.sql
```

**Expected Results:**
- New columns added to `resources` table
- Existing data migrated to new structure
- Foreign key constraints established

**Verification:**
```sql
-- Check that all resources have been migrated
SELECT 
  COUNT(*) as total,
  COUNT(title) as with_title,
  COUNT(branch_id) as with_branch_id,
  COUNT(year_id) as with_year_id,
  COUNT(semester_id) as with_semester_id
FROM resources;
```

### Phase 4: Data Validation and Cleanup

```bash
psql -h your-supabase-host -U postgres -d postgres -f scripts/database-refactor-phase4-data-validation.sql
```

**Expected Results:**
- Data integrity validation performed
- Any missing or invalid data fixed
- New columns made NOT NULL (if validation passes)

**Verification:**
- Review the output for any warnings or errors
- Ensure all validation checks pass

### Phase 5: Schema Cleanup (DESTRUCTIVE)

⚠️ **WARNING**: This phase removes old columns permanently. Ensure phases 1-4 completed successfully and backup is secure.

```bash
psql -h your-supabase-host -U postgres -d postgres -f scripts/database-refactor-phase5-cleanup-old-schema.sql
```

**Expected Results:**
- Old columns removed from `resources` table
- Backup tables created
- Schema comments updated

**What gets removed:**
- `resources.name` → replaced by `title`
- `resources.url` → replaced by `drive_link`
- `resources.type` → replaced by `file_type`
- `resources.branch` → replaced by `branch_id`
- `resources.year` → replaced by `year_id`
- `resources.semester` → replaced by `semester_id`
- `resources.created_by` → replaced by `uploader_id`

### Phase 6: Update Application Code

This phase involves updating your application code to work with the new schema:

1. **Replace type definitions:**
   ```bash
   # Copy new types file
   cp lib/types.ts lib/types.ts.backup
   # Use the new types.ts file provided
   ```

2. **Update API routes:**
   ```bash
   # Replace existing routes with new schema versions
   cp app/api/resources/route.ts app/api/resources/route-old.ts
   cp app/api/resources/route-new-schema.ts app/api/resources/route.ts
   
   cp app/api/profile/route.ts app/api/profile/route-old.ts
   cp app/api/profile/route-new-schema.ts app/api/profile/route.ts
   ```

3. **Add new API routes:**
   - `app/api/academic-calendar/route.ts`
   - `app/api/branches/route.ts`
   - `app/api/years/route.ts`
   - `app/api/students/route.ts`

4. **Update frontend components** (if needed):
   - Update forms to use new foreign key selectors
   - Update resource display components
   - Update profile management components

### Phase 7: Enable Row Level Security

```bash
psql -h your-supabase-host -U postgres -d postgres -f scripts/database-refactor-phase7-enable-rls.sql
```

**Expected Results:**
- RLS enabled on all new tables
- Appropriate policies created for different user roles
- Helper functions created for policy enforcement

**Security Policies:**
- **Branches/Years/Semesters**: Public read, admin write
- **Students**: Users see own profile, admins see all
- **Academic Calendar**: Public read, superadmin write
- **Resources**: Students see relevant resources, admins see all

### Phase 8: Testing and Validation

```bash
psql -h your-supabase-host -U postgres -d postgres -f scripts/database-refactor-phase8-testing.sql
```

**Expected Results:**
- Comprehensive validation of all components
- Performance testing of new queries
- Data distribution analysis
- RLS policy verification

## Post-Migration Steps

### 1. Application Testing

Test all major functionality:
- [ ] User authentication and profile management
- [ ] Resource browsing and filtering
- [ ] Resource upload (if implemented)
- [ ] Admin dashboard functionality
- [ ] Academic calendar management

### 2. Performance Monitoring

Monitor key queries for performance:
```sql
-- Example: Test resource lookup performance
EXPLAIN ANALYZE
SELECT r.title, b.name, y.display_name, s.semester_number
FROM resources r
JOIN branches b ON r.branch_id = b.id
JOIN years y ON r.year_id = y.id
JOIN semesters s ON r.semester_id = s.id
WHERE b.code = 'CSE' AND y.batch_year = 2024;
```

### 3. Cleanup

After confirming everything works correctly:
```sql
-- Remove backup tables (only after thorough testing)
DROP TABLE IF EXISTS resources_backup;
DROP TABLE IF EXISTS profiles_backup; -- if created
```

### 4. Documentation Updates

- Update API documentation
- Update database schema documentation
- Update deployment guides
- Update development setup instructions

## Rollback Plan

If issues arise during migration, you can rollback using the backup tables:

```sql
-- Restore resources from backup
DROP TABLE resources;
ALTER TABLE resources_backup RENAME TO resources;

-- Restore profiles if needed
DROP TABLE students;
-- (profiles table should still exist if Phase 5 wasn't completed)

-- Drop new tables
DROP TABLE academic_calendar;
DROP TABLE semesters;
DROP TABLE years;
DROP TABLE branches;
```

## Troubleshooting

### Common Issues

1. **Foreign Key Constraint Violations**
   - Check that all referenced IDs exist in lookup tables
   - Verify data migration completed successfully

2. **RLS Policy Issues**
   - Ensure `auth.jwt()` returns expected email format
   - Check admin table has correct email addresses

3. **Performance Issues**
   - Add additional indexes if needed
   - Consider materialized views for complex queries

4. **Data Inconsistencies**
   - Run Phase 4 validation again
   - Check for NULL values in required fields

### Getting Help

If you encounter issues:
1. Check the PostgreSQL logs for detailed error messages
2. Review the output from each phase carefully
3. Ensure all prerequisites are met
4. Verify backup integrity before proceeding

## Migration Timeline

Estimated time for each phase:
- Phase 1: 5-10 minutes
- Phase 2: 5-15 minutes (depending on profile data volume)
- Phase 3: 10-30 minutes (depending on resource data volume)
- Phase 4: 5-15 minutes
- Phase 5: 5-10 minutes
- Phase 6: 30-60 minutes (application code updates)
- Phase 7: 5-10 minutes
- Phase 8: 10-20 minutes

**Total estimated time: 1.5-3 hours** (excluding thorough application testing)

---

**Note**: This migration is comprehensive and changes fundamental aspects of your database schema. Take time to understand each phase and test thoroughly in a development environment before applying to production.
