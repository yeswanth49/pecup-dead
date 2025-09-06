# Database Schema Migration Plan

## Overview

This migration plan addresses 6 critical schema red flags by transforming the database from enum-based design to normalized foreign key relationships. The migrations create a unified identity model, fix resource table overloading, and establish proper audit trails.

## Migration Files & Execution Order

### Phase 1: Identity Consolidation
**File:** `001_create_unified_users.sql`  
**Purpose:** Create canonical `users` table consolidating profiles/students/admins  
**Risk Level:** Medium  
**Downtime:** None  
**Duration:** 5-10 minutes

### Phase 2: Academic Structure Enhancement
**File:** `002_enhance_branches_years_semesters.sql`  
**Purpose:** Standardize branch/year/semester with FK relationships  
**Risk Level:** Low  
**Downtime:** None  
**Duration:** 5-10 minutes

### Phase 3: Resource Table Normalization
**File:** `003_split_resources_tables.sql`  
**Purpose:** Split overloaded resources table into resources + files + metadata  
**Risk Level:** High  
**Downtime:** 20-30 minutes  
**Duration:** 15-30 minutes

### Phase 4: Audit System Unification
**File:** `004_migrate_audit_logs.sql`  
**Purpose:** Migrate audit logs to unified actor references  
**Risk Level:** Medium  
**Downtime:** None  
**Duration:** 10-15 minutes

### Phase 5: Settings Architecture Fix
**File:** `005_fix_settings_singleton.sql`  
**Purpose:** Replace hacky singleton with proper key-value structure  
**Risk Level:** Low  
**Downtime:** None  
**Duration:** 5-10 minutes

### Phase 6: Data Consolidation & Cleanup
**File:** `006_data_consolidation.sql`  
**Purpose:** Consolidate all data and update RLS policies  
**Risk Level:** High  
**Downtime:** 20-30 minutes  
**Duration:** 20-40 minutes

### Phase 7: Security Policy Updates
**File:** `007_update_rls_policies.sql`  
**Purpose:** Comprehensive RLS policy updates for new schema  
**Risk Level:** High  
**Downtime:** None  
**Duration:** 10-15 minutes

## Execution Prerequisites

### Environment Requirements
- **PostgreSQL Version:** 13+ (with UUID support)
- **Extensions:** `pgcrypto`, `uuid-ossp`
- **Backup:** Complete database backup required
- **Testing:** Staging environment with production data copy

### Important Notes
- **Conditional Table References:** All migrations now check for table existence before referencing them
- **Safe Fallbacks:** Missing tables won't cause migration failures, they'll be skipped with notices
- **Idempotent Operations:** All migrations can be run multiple times safely
- **Rollback Ready:** Backup tables are created automatically for critical data

### Pre-Migration Checklist
- [ ] Database backup completed and verified
- [ ] Staging environment set up with production data
- [ ] Application code updated to handle new schema
- [ ] Rollback plan documented and tested
- [ ] Maintenance window scheduled (if required)

## Execution Instructions

### Option A: Automated Execution (Recommended)
```bash
# Set database connection
export DATABASE_URL="postgresql://user:pass@host:5432/db"

# Execute all migrations in order
for migration in 001_create_unified_users.sql \
                 002_enhance_branches_years_semesters.sql \
                 003_split_resources_tables.sql \
                 004_migrate_audit_logs.sql \
                 005_fix_settings_singleton.sql \
                 006_data_consolidation.sql \
                 007_update_rls_policies.sql; do
  echo "Executing $migration..."
  psql "$DATABASE_URL" -f "$migration"
  if [ $? -ne 0 ]; then
    echo "Migration $migration failed. Check logs and rollback if needed."
    exit 1
  fi
done
```

### Option B: Manual Execution
```bash
# Using psql directly
psql -h your-host -U your-user -d your-database -f 001_create_unified_users.sql
psql -h your-host -U your-user -d your-database -f 002_enhance_branches_years_semesters.sql
# ... continue for each file
```

### Option C: Supabase CLI
```bash
# If using Supabase CLI
supabase db push
# Or apply individual migrations
supabase db reset  # For development
```

## Verification Steps

### After Each Migration
Run the verification queries included in each migration file:

```sql
-- Example verification queries
SELECT 'Users created:' as check, COUNT(*) as count FROM users;
SELECT 'Resources migrated:' as check, COUNT(*) as count FROM resources_new;
-- Check for orphaned records, FK violations, etc.
```

### Post-Migration Testing
1. **Data Integrity:** Verify all FK constraints satisfied
2. **Application Functionality:** Test CRUD operations
3. **RLS Policies:** Verify access control working
4. **Performance:** Monitor query response times
5. **Audit Trail:** Confirm audit logging functional

## Rollback Plan

### Emergency Rollback (if critical issues)
```sql
-- Restore from backup tables
DROP TABLE users CASCADE;
DROP TABLE user_profiles CASCADE;
-- ... drop other new tables

ALTER TABLE resources_backup RENAME TO resources;
ALTER TABLE audit_logs_backup RENAME TO audit_logs;
-- ... restore other backup tables
```

### Gradual Rollback (for non-critical issues)
1. Switch application to use compatibility views
2. Gradually migrate back to old schema
3. Clean up new tables after full migration

## Risk Mitigation

### High-Risk Migrations (Phases 3 & 6)
- **Downtime Required:** 20-30 minutes
- **Data Volume Impact:** High (resources table)
- **Testing Priority:** Execute first in staging
- **Monitoring:** Real-time row count verification

### Medium-Risk Migrations (Phases 1 & 4)
- **Downtime Required:** None
- **Data Volume Impact:** Medium
- **Testing Priority:** Standard testing cycle
- **Monitoring:** FK constraint verification

### Low-Risk Migrations (Phases 2, 5 & 7)
- **Downtime Required:** None
- **Data Volume Impact:** Low
- **Testing Priority:** Basic verification
- **Monitoring:** Policy function testing

## Performance Considerations

### Expected Impact
- **Initial:** 10-20% performance degradation due to FK joins
- **After Optimization:** Potential 5-10% improvement through better indexing
- **Long-term:** Significant improvement with query optimization

### Monitoring Queries
```sql
-- Monitor slow queries
SELECT query, total_time, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Timeline & Milestones

### Phase 1-3 (Week 1): Foundation
- Execute identity consolidation
- Enhance academic structures
- Split resource tables
- **Milestone:** Basic schema operational

### Phase 4-5 (Week 2): Integration
- Migrate audit system
- Fix settings architecture
- **Milestone:** All tables migrated

### Phase 6-7 (Week 3): Consolidation
- Data consolidation and cleanup
- Security policy updates
- **Milestone:** Production ready

### Week 4: Testing & Deployment
- Staging environment testing
- Performance optimization
- Production deployment
- **Milestone:** Live in production

## Success Metrics

### Data Integrity
- [ ] All FK constraints satisfied (0 orphaned records)
- [ ] Row counts match pre-migration totals
- [ ] No data loss in migration

### Performance
- [ ] Query response times within 10% of baseline
- [ ] No queries > 5 seconds
- [ ] Index usage > 90% for primary queries

### Security
- [ ] RLS policies working correctly
- [ ] No unauthorized data access
- [ ] Audit trail complete and accurate

### Functionality
- [ ] All application features working
- [ ] API compatibility maintained
- [ ] External clients unaffected

## Support & Troubleshooting

### Common Issues
1. **FK Constraint Violations:** Check data migration completeness
2. **RLS Policy Blocks:** Verify user authentication and roles
3. **Performance Degradation:** Check query plans and add indexes
4. **Application Errors:** Update code to use new table names

### Getting Help
1. Check migration verification queries for issues
2. Review PostgreSQL logs for detailed error messages
3. Test in staging before production deployment
4. Have rollback scripts ready for emergency recovery

## Troubleshooting

### Common Migration Errors

#### "relation 'admin_scopes' does not exist"
**Symptom:** Migration fails with table not found error
**Cause:** Migration references tables that may not exist in all database setups
**Solution:** ✅ **FIXED** - All migrations now check for table existence before referencing them
**Action:** Re-run the migration - it will now skip missing tables gracefully

#### "duplicate key value violates unique constraint"
**Symptom:** Unique constraint violation during data migration
**Cause:** Duplicate data being inserted
**Solution:** Check the `ON CONFLICT` clauses in migration files
**Action:** Review source data for duplicates before migration

#### "permission denied for table"
**Symptom:** Migration fails due to insufficient permissions
**Cause:** User doesn't have required privileges
**Solution:** Grant necessary permissions or run as superuser
**Action:** `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_user;`

#### "new row for relation 'semesters' violates check constraint 'semesters_semester_number_check'"
**Symptom:** Migration fails when inserting semesters beyond 1-2
**Cause:** Existing check constraint limits semester_number to only 1 and 2
**Solution:** ✅ **FIXED** - Added code to drop restrictive check constraints
**Action:** Re-run the migration - it will now allow flexible semester numbering

#### "column 'singleton' of relation 'academic_calendar' does not exist"
**Symptom:** Migration fails when trying to insert into academic_calendar table
**Cause:** Table exists but missing singleton column for single-row pattern
**Solution:** ✅ **FIXED** - Added ALTER TABLE statements to add missing columns
**Action:** Re-run the migration - it will now add missing columns automatically

#### "column 'program_type' of relation 'years' does not exist"
**Symptom:** Migration fails when trying to insert into years table
**Cause:** Table exists but missing new columns from schema enhancements
**Solution:** ✅ **FIXED** - Added ALTER TABLE statements to add missing columns
**Action:** Re-run the migration - it will now add missing columns automatically

#### "failed SASL auth (invalid SCRAM server-final-message received from server)"
**Symptom:** CLI fails to connect with authentication error
**Cause:** Connection pooler issues or authentication token problems
**Solution:** ✅ Use Supabase Dashboard instead of CLI
**Action:** Follow the steps in `final-dashboard-migration.md`

#### "function set_updated_at() does not exist"
**Symptom:** Trigger function missing
**Cause:** Function not created yet when trigger is defined
**Solution:** ✅ **FIXED** - Functions are created before being referenced
**Action:** Ensure migrations are run in correct order

## Post-Migration Tasks

### Immediate (Week 1)
- [ ] Update application code for new schema
- [ ] Test all user workflows
- [ ] Monitor performance metrics
- [ ] Document any issues found

### Short-term (Month 1)
- [ ] Optimize slow queries
- [ ] Clean up old schema elements
- [ ] Update API documentation
- [ ] Train development team on new schema

### Long-term (Months 2-3)
- [ ] Implement advanced features using new schema
- [ ] Performance tuning based on usage patterns
- [ ] Consider additional normalization opportunities
- [ ] Plan for future schema evolution

---

**Note:** This migration plan is comprehensive and addresses fundamental schema issues. Execute in staging first, verify thoroughly, then deploy to production during a maintenance window. Keep backups available for at least 30 days post-migration.
