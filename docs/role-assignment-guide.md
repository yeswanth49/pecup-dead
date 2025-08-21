# Role Assignment Guide (Code-Only)

Since you want to manage roles through code only (no web interface), here are the methods to assign roles:

## 🔧 Method 1: TypeScript Utilities

Use the programmatic functions in `lib/role-management.ts`:

```typescript
import { assignRepresentative, assignAdmin, assignSuperAdmin } from '@/lib/role-management'

// Assign representative
await assignRepresentative('student@college.edu', [
  { branchCode: 'CSE', batchYear: 2024 },
  { branchCode: 'AIML', batchYear: 2024 }
])

// Assign admin
await assignAdmin('admin@college.edu')

// Assign superadmin  
await assignSuperAdmin('superadmin@college.edu')
```

## 🔧 Method 2: Command Line Script

Use the administrative script:

```bash
# Assign representative
npx ts-node scripts/assign-roles.ts assign-representative student@college.edu CSE 2024

# Assign admin
npx ts-node scripts/assign-roles.ts assign-admin admin@college.edu

# Assign superadmin
npx ts-node scripts/assign-roles.ts assign-superadmin super@college.edu

# List current representatives
npx ts-node scripts/assign-roles.ts list-representatives

# Get user info
npx ts-node scripts/assign-roles.ts get-user-info student@college.edu

# Remove representative
npx ts-node scripts/assign-roles.ts remove-representative student@college.edu
```

## 🔧 Method 3: Direct SQL

Use the SQL examples in `scripts/role-management-examples.sql`:

```sql
-- Assign superadmin (change the email)
DO $$
DECLARE
    user_email TEXT := 'super@college.edu';  -- CHANGE THIS
BEGIN
    UPDATE profiles SET role = 'superadmin' WHERE email = user_email;
    INSERT INTO admins (email, role) VALUES (user_email, 'superadmin')
    ON CONFLICT (email) DO UPDATE SET role = 'superadmin';
END $$;

-- Assign representative (change email, branch, year)
DO $$
DECLARE
    user_email TEXT := 'rep@college.edu';  -- CHANGE THIS
    branch_code TEXT := 'CSE';             -- CHANGE THIS  
    batch_year INT := 2024;                -- CHANGE THIS
    user_uuid UUID;
    branch_uuid UUID;
    year_uuid UUID;
BEGIN
    SELECT id INTO user_uuid FROM profiles WHERE email = user_email;
    SELECT id INTO branch_uuid FROM branches WHERE code = branch_code;
    SELECT id INTO year_uuid FROM years WHERE batch_year = batch_year;
    
    UPDATE profiles SET role = 'representative' WHERE id = user_uuid;
    
    INSERT INTO representatives (user_id, branch_id, year_id, active)
    VALUES (user_uuid, branch_uuid, year_uuid, true)
    ON CONFLICT (user_id, branch_id, year_id) DO UPDATE SET active = true;
END $$;
```

## 📋 Quick Reference

### Role Hierarchy
1. **Student**: Read-only access to their branch/year content
2. **Representative**: Manage content + promote semesters for assigned branch/year
3. **Admin**: Full access to all content and user management  
4. **Superadmin**: Full system access including settings

### Tables Involved
- `profiles.role` - User's primary role
- `admins` - Admin/superadmin users
- `representatives` - Representative assignments (branch/year scope)

### Permission Scope
- **Students**: Filtered by their own branch/year
- **Representatives**: Limited to assigned branch/year combinations
- **Admins**: Full access to everything

## 🚀 Quick Start Example

To set up your first representative:

```bash
# 1. Apply the database migration first
# Run scripts/add-representative-role-migration.sql in Supabase

# 2. Assign a representative
npx ts-node scripts/assign-roles.ts assign-representative student@college.edu CSE 2024

# 3. Verify the assignment
npx ts-node scripts/assign-roles.ts get-user-info student@college.edu

# 4. The user can now login and see representative features
```

## ✅ Verification

After assigning roles, verify they work:

```sql
-- Check all role assignments
SELECT 
    p.email,
    p.role,
    CASE 
        WHEN p.role = 'representative' THEN 
            (SELECT string_agg(b.code || ' Y' || y.batch_year, ', ')
             FROM representatives r
             JOIN branches b ON r.branch_id = b.id
             JOIN years y ON r.year_id = y.id  
             WHERE r.user_id = p.id AND r.active = true)
        ELSE 'N/A'
    END as assignments
FROM profiles p
WHERE p.role != 'student'
ORDER BY p.role, p.email;
```

This approach gives you full control over role assignment while keeping the web interface clean and focused on content management rather than user administration.
