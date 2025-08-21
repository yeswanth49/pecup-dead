# Admin Setup Guide for Role-Based Permissions

## Quick Setup Steps

### 1. Apply Database Migration

Run the migration to add the representative role and new tables:

```sql
-- Run this in your Supabase SQL editor
-- File: scripts/add-representative-role-migration.sql
```

This will:
- Add `representative` to the `user_role` enum
- Create `representatives` table
- Create `semester_promotions` table  
- Set up RLS policies for the new permission system

### 2. Assign Representatives

#### Via API (Recommended)
```bash
curl -X POST /api/admin/representatives \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-here",
    "branchId": "branch-uuid-here", 
    "yearId": "year-uuid-here"
  }'
```

#### Via Database (Direct)
```sql
-- 1. First, update the user's role
UPDATE profiles 
SET role = 'representative' 
WHERE email = 'student@example.com';

-- 2. Then create the representative assignment
INSERT INTO representatives (user_id, branch_id, year_id, active)
SELECT p.id, b.id, y.id, true
FROM profiles p, branches b, years y
WHERE p.email = 'student@example.com'
  AND b.code = 'CSE'  -- or other branch code
  AND y.batch_year = 2024;  -- or other year
```

### 3. Test the System

#### Check User Roles
```sql
-- View all users and their roles
SELECT email, name, role, year, branch 
FROM profiles 
ORDER BY role, email;

-- View representative assignments
SELECT 
  p.email,
  p.name,
  b.code as branch,
  y.batch_year as year,
  r.active
FROM representatives r
JOIN profiles p ON r.user_id = p.id
JOIN branches b ON r.branch_id = b.id  
JOIN years y ON r.year_id = y.id
ORDER BY p.email;
```

#### Test API Endpoints
```bash
# Get user context
curl /api/user/context

# Get representative resources (as representative)
curl /api/representative/resources

# Get admin representatives list (as admin)
curl /api/admin/representatives
```

## Permission Matrix

| Action | Student | Representative | Admin | Super Admin |
|--------|---------|----------------|-------|-------------|
| View resources (own scope) | ✅ | ✅ | ✅ | ✅ |
| View resources (all) | ❌ | ❌ | ✅ | ✅ |
| Create resources | ❌ | ✅ (scope) | ✅ | ✅ |
| Delete resources | ❌ | ✅ (scope) | ✅ | ✅ |
| Promote semester | ❌ | ✅ (scope) | ✅ | ✅ |
| Assign representatives | ❌ | ❌ | ✅ | ✅ |
| Manage system settings | ❌ | ❌ | ✅ | ✅ |
| View audit logs | ❌ | ❌ | ✅ | ✅ |

## Common Workflows

### Making Someone a Representative

1. **Identify the Student**: Find their profile in the database
2. **Choose Scope**: Determine which branch(es) and year(s) they should manage
3. **Assign Role**: Use the admin dashboard or API to assign them
4. **Verify**: Check that they can access representative features
5. **Train**: Explain their new permissions and responsibilities

### Promoting Students to Next Semester

1. **Login as Representative**: Access the management dashboard
2. **Select Scope**: Choose your assigned branch and year
3. **Choose Semesters**: Select source (current) and target (next) semester
4. **Review**: Confirm the students who will be promoted
5. **Execute**: Run the promotion (this updates all students at once)
6. **Verify**: Check that students appear in the new semester

### Removing Representative Access

1. **Admin Dashboard**: Go to Representatives section
2. **Find Assignment**: Locate the representative to remove
3. **Deactivate**: Click remove/deactivate
4. **Auto-Downgrade**: System automatically changes role to 'student' if no other assignments
5. **Verify**: Confirm they no longer have representative access

## Security Best Practices

### For Admins
- Only assign representative roles to trusted students
- Regularly review representative assignments
- Monitor audit logs for unusual activity
- Use principle of least privilege (assign minimal necessary scope)

### For Representatives  
- Only manage content for your assigned branch/year
- Be careful when promoting semesters (affects all students)
- Report any issues or suspicious activity to admins
- Keep your account secure (strong password, etc.)

### For Students
- Report any access issues to representatives or admins
- Don't share login credentials
- Contact representatives for content requests in your branch/year

## Troubleshooting

### "Forbidden" Errors
1. Check user's role in `profiles` table
2. For representatives, verify active assignment in `representatives` table
3. Ensure scope matches (correct branch/year combination)
4. Check RLS policies are enabled and correct

### Representative Not Seeing Management Features
1. Verify role is set to 'representative' in profiles
2. Check active assignment exists in representatives table
3. Ensure frontend is fetching user context correctly
4. Clear browser cache/cookies if needed

### Semester Promotion Issues
1. Verify sequential semester progression (1→2 same year, 2→1 next year)
2. Check students exist in source semester
3. Ensure target semester exists in database
4. Verify representative has permission for that branch/year

### Database Queries for Debugging

```sql
-- Check enum values
SELECT unnest(enum_range(NULL::user_role)) as role;

-- Check table structure
\d representatives
\d semester_promotions

-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename IN ('representatives', 'semester_promotions', 'resources');

-- Check user permissions
SELECT p.email, p.role, 
       COALESCE(array_agg(DISTINCT b.code) FILTER (WHERE r.active), ARRAY[]::text[]) as rep_branches,
       COALESCE(array_agg(DISTINCT y.batch_year) FILTER (WHERE r.active), ARRAY[]::int[]) as rep_years
FROM profiles p
LEFT JOIN representatives r ON p.id = r.user_id AND r.active = true
LEFT JOIN branches b ON r.branch_id = b.id
LEFT JOIN years y ON r.year_id = y.id
GROUP BY p.id, p.email, p.role
ORDER BY p.role, p.email;
```

## Next Steps

After implementing the permission system:

1. **User Training**: Educate representatives on their new capabilities
2. **Monitoring**: Set up alerts for audit log anomalies  
3. **Feedback**: Collect user feedback on the permission system
4. **Optimization**: Fine-tune permissions based on usage patterns
5. **Documentation**: Keep this guide updated with any changes

## Support

For issues with the permission system:
1. Check this documentation first
2. Review audit logs for clues
3. Test with different user roles
4. Contact system administrators if problems persist
