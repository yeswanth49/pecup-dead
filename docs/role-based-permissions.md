# Role-Based Permission System

## Overview

This application implements a three-tier role-based access control (RBAC) system with the following roles:

### 1. Student
- **Access Level**: Read-only
- **Scope**: Resources filtered by their branch and year
- **Permissions**:
  - ✅ View resources for their branch and year
  - ✅ View reminders for their branch and year  
  - ✅ View recent updates for their branch and year
  - ✅ View exams for their branch and year
  - ✅ View and edit their own profile
  - ❌ Cannot create, edit, or delete any content
  - ❌ Cannot promote semesters
  - ❌ Cannot access admin features

### 2. Representative
- **Access Level**: Manage content for assigned branch(es) and year(s)
- **Scope**: Limited to their assigned branch/year combinations
- **Permissions**:
  - ✅ All student permissions
  - ✅ Create, edit, delete resources for assigned branch/year
  - ✅ Create, edit, delete reminders for assigned branch/year
  - ✅ Create, edit, delete recent updates for assigned branch/year
  - ✅ Create, edit, delete exams for assigned branch/year
  - ✅ Promote students to next semester for assigned branch/year
  - ✅ View promotion history for their scope
  - ❌ Cannot manage users or system settings
  - ❌ Cannot assign other representatives
  - ❌ Cannot access content outside their assigned scope

### 3. Admin/Super Admin
- **Access Level**: Full system access
- **Scope**: All branches, years, and system features
- **Permissions**:
  - ✅ All representative permissions across all branches/years
  - ✅ Manage user profiles and roles
  - ✅ Assign and remove representatives
  - ✅ Access system settings
  - ✅ View audit logs
  - ✅ Manage admin accounts (super admin only)
  - ✅ Full database access

## Database Schema

### New Tables

#### `representatives`
Tracks users assigned as representatives for specific branch/year combinations.

```sql
CREATE TABLE representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, branch_id, year_id)
);
```

#### `semester_promotions`
Tracks semester promotions performed by representatives and admins.

```sql
CREATE TABLE semester_promotions (
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
```

### Updated Enums

#### `user_role`
```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'representative';
-- Now supports: 'student', 'representative', 'admin', 'superadmin'
```

## API Endpoints

### Representative Management (Admin Only)

#### `GET /api/admin/representatives`
List all representative assignments.

#### `POST /api/admin/representatives`
Assign a user as representative for a branch/year.
```json
{
  "userId": "uuid",
  "branchId": "uuid", 
  "yearId": "uuid"
}
```

#### `DELETE /api/admin/representatives/[id]`
Remove a representative assignment.

#### `PATCH /api/admin/representatives/[id]`
Update a representative assignment.

### Semester Promotion

#### `POST /api/semester-promotion`
Promote students to next semester (representatives and admins).
```json
{
  "branchId": "uuid",
  "yearId": "uuid",
  "fromSemesterId": "uuid",
  "toSemesterId": "uuid",
  "notes": "optional notes"
}
```

#### `GET /api/semester-promotion`
View promotion history (filtered by user role).

### Representative Resource Management

#### `GET /api/representative/resources`
Get resources that the representative can manage.

#### `POST /api/representative/resources`
Create a new resource (within representative's scope).

#### `DELETE /api/representative/resources/[id]`
Delete a resource (within representative's scope).

#### `PATCH /api/representative/resources/[id]`
Update a resource (within representative's scope).

### User Context

#### `GET /api/user/context`
Get current user's context, role, and permissions.

## Permission Checking

### Backend Authorization

The system uses several utility functions for permission checking:

```typescript
// Get current user context with role and assignments
const userContext = await getCurrentUserContext()

// Check specific permissions
const userContext = await requirePermission('write', 'resources', branchId, yearId)

// Check resource management permissions
const canManage = await canManageResources(branchId, yearId)

// Check semester promotion permissions  
const canPromote = await canPromoteSemester(branchId, yearId)

// Get user's complete permission set
const permissions = await getUserPermissions(userContext)
```

### Frontend Permission Handling

The frontend receives user context and permissions via `/api/user/context`:

```typescript
interface UserContext {
  id: string
  email: string
  name: string
  role: UserRole
  year?: number
  branch?: string
  representatives?: Representative[]
}

interface UserPermissions {
  canRead: { resources: boolean, reminders: boolean, ... }
  canWrite: { resources: boolean, reminders: boolean, ... }
  canDelete: { resources: boolean, reminders: boolean, ... }
  canPromoteSemester: boolean
  scopeRestrictions?: {
    branchIds?: string[]
    yearIds?: string[]
  }
}
```

## Row Level Security (RLS)

The system uses PostgreSQL RLS policies to enforce permissions at the database level:

### Resources
- Public read access (filtered by application logic)
- Representatives can manage resources for their assigned branch/year
- Admins can manage all resources

### Representatives Table
- Users can view their own assignments
- Admins can manage all assignments

### Semester Promotions
- Users can view promotions they performed
- Admins can view all promotions
- Representatives and admins can create promotions (with scope validation)

## Implementation Files

### Core Permission System
- `lib/auth-permissions.ts` - Main authorization utilities
- `lib/types.ts` - TypeScript interfaces for roles and permissions
- `scripts/add-representative-role-migration.sql` - Database migration

### API Routes
- `app/api/admin/representatives/` - Representative management
- `app/api/semester-promotion/` - Semester promotion functionality
- `app/api/representative/resources/` - Representative resource management
- `app/api/user/context/` - User context and permissions

### Frontend Components
- `app/dashboard/page.tsx` - Role-aware dashboard
- `app/(protected)/home/page.tsx` - Updated home page with role display
- `app/(protected)/layout.tsx` - Updated protected layout

## Usage Examples

### Assigning a Representative

1. Admin logs into dashboard
2. Goes to Representatives section
3. Selects a student user
4. Assigns them to specific branch/year combination
5. User's role is automatically updated to 'representative'
6. User gains management permissions for that scope

### Representative Managing Resources

1. Representative logs in
2. Sees only their assigned branch/year combinations
3. Can create/edit/delete resources within their scope
4. Cannot access resources outside their assignments
5. All actions are logged in audit trail

### Semester Promotion

1. Representative or admin selects branch/year
2. Chooses source and target semesters
3. System validates the promotion is sequential
4. All students in that branch/year/semester are promoted
5. Action is logged with details and student count

## Security Considerations

1. **Scope Validation**: All operations validate user scope at multiple levels
2. **Audit Logging**: All administrative actions are logged
3. **RLS Enforcement**: Database-level security policies prevent unauthorized access
4. **Role Verification**: API endpoints verify user roles before processing
5. **Input Validation**: All inputs are validated and sanitized

## Migration Guide

To apply the new permission system:

1. Run the migration script: `scripts/add-representative-role-migration.sql`
2. Deploy the updated API routes
3. Update frontend components to use new permission system
4. Assign representatives through the admin dashboard
5. Test the permission system with different user roles

## Troubleshooting

### Common Issues

1. **User not seeing representative features**: Check if they're assigned in `representatives` table
2. **Permission denied errors**: Verify user has correct role and active assignments
3. **Scope restrictions not working**: Check RLS policies are enabled and correct
4. **Audit log issues**: Verify audit logging functions are working correctly

### Debug Queries

```sql
-- Check user's role and assignments
SELECT p.email, p.role, r.branch_id, r.year_id, r.active
FROM profiles p
LEFT JOIN representatives r ON p.id = r.user_id
WHERE p.email = 'user@example.com';

-- Check promotion history
SELECT sp.*, p.name as promoter_name
FROM semester_promotions sp
JOIN profiles p ON sp.promoted_by = p.id
ORDER BY sp.promotion_date DESC;
```
