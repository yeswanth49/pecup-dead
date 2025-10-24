# Data Fetching Guide for Academic System

This guide explains how to fetch academic data efficiently. The preferred approach is to use the bulk endpoint and hydrate a single client context. Raw SQL examples are kept below for reference and admin/reporting scenarios.

## Table of Contents
1. [Bulk API Approach](#bulk-api-approach)
2. [Using the `useProfile()` Hook](#using-the-useprofile-hook)
3. [Database Schema Overview](#database-schema-overview)
4. [Key Relationships](#key-relationships)
5. [Common Query Patterns](#common-query-patterns)
6. [Specific Examples](#specific-examples)
7. [Advanced Queries](#advanced-queries)
8. [Performance Considerations](#performance-considerations)

## Bulk API Approach

- **Endpoint**: `GET /api/bulk-academic-data`
- **What it returns**: `profile`, `subjects`, `static` (branches, years, semesters), `dynamic` (recentUpdates, upcomingExams, upcomingReminders), `resources` (all resources for subjects), optional `contextWarnings`, and `meta.timings`.
- **Why**: Reduces redundant calls and DB queries by ~80%, enables robust client-side caching, prefetches resources to eliminate on-demand loading.

Response shape (simplified):
```json
{
  "profile": { "id": "uuid", "email": "...", "year": 1, "branch": "CSE", "semester": 1 },
  "subjects": [ { "id": "uuid", "code": "CS101", "name": "Programming" } ],
  "static": { "branches": [], "years": [], "semesters": [] },
  "dynamic": { "recentUpdates": [], "upcomingExams": [], "upcomingReminders": [] },
  "resources": {
    "CS101": {
      "notes": [ { "id": "uuid", "name": "Lecture 1", "type": "pdf", "url": "...", "unit": 1 } ],
      "assignments": [ { "id": "uuid", "name": "Assignment 1", "type": "doc", "url": "...", "unit": 1 } ]
    }
  }
}
```

Errors:
```json
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "Unauthorized" } }
```

## Using the `useProfile()` Hook

The app exposes a client context at `lib/enhanced-profile-context.tsx` that fetches from the bulk endpoint, caches data, and exposes helpers.

Minimal example:
```tsx
import { useProfile } from '@/lib/enhanced-profile-context'

export function HomeSummary() {
  const { profile, subjects, dynamicData, loading, error, warnings, forceRefresh } = useProfile()
  if (loading) return <div>Loading…</div>
  if (error) return <div className="text-red-600">{error}</div>
  return (
    <div>
      <div>Welcome, {profile?.name ?? profile?.email}</div>
      <div>Subjects: {subjects.length}</div>
      <div>Recent updates: {dynamicData?.recentUpdates?.length ?? 0}</div>
      {Array.isArray(warnings) && warnings.length > 0 && (
        <div className="text-amber-600 text-sm">{warnings[0]}</div>
      )}
      <button onClick={forceRefresh}>Refresh</button>
    </div>
  )
}
```

Key behaviors:
- **Caching**:
  - `ProfileCache`: sessionStorage (no TTL; session-scoped)
  - `DynamicCache`: sessionStorage (TTL: 10 minutes)
  - `StaticCache`: localStorage (TTL: 30 days)
  - `SubjectsCache`: localStorage (no TTL; context-keyed)
  - `ResourcesCache`: localStorage (TTL: 3 days; context-keyed)
- **Auto-refresh**: Dynamic data is refreshed when the tab regains focus if the cache expired.
- **Cross-tab sync**: Updates are broadcast between tabs to avoid duplicate network calls.
- **Prefetching**: Resources are prefetched in the bulk API and cached per category/subject for instant loading.
## Database Schema Overview

The system uses the following key tables for data retrieval:
- `students` - Student information with references to branch, year, and semester
- `branches` - Academic branches (CSE, ECE, etc.)
- `years` - Academic years/batches
- `semesters` - Semester information
- `reminders` - Student reminders and notifications
- `recent_updates` - Recent announcements and updates
- `resources` - Academic resources and materials
- `exams` - Exam schedules and information

## Key Relationships

```sql
-- Students are linked to:
students.branch_id → branches.id
students.year_id → years.id
students.semester_id → semesters.id

-- Content tables (reminders, recent_updates, resources, exams) filter by:
-- - year (smallint) - Academic year (1, 2, 3, 4)
-- - branch (USER-DEFINED type) - Branch code/name
```

## Common Query Patterns

### 1. Getting Branch Information
```sql
-- Find CSE branch details
SELECT id, name, code 
FROM branches 
WHERE code = 'CSE' OR name ILIKE '%computer%';
```

### 2. Getting Year Information
```sql
-- Find 2nd year details
SELECT id, batch_year, display_name 
FROM years 
WHERE display_name ILIKE '%2nd%' OR display_name ILIKE '%second%';

-- Alternative: If years are stored as numeric values
SELECT id, batch_year, display_name 
FROM years 
WHERE batch_year = 2023; -- Adjust based on current batch
```

### 3. Basic Student Lookup
```sql
-- Find all CSE 2nd year students
SELECT s.*, b.name as branch_name, y.display_name as year_name
FROM students s
JOIN branches b ON s.branch_id = b.id
JOIN years y ON s.year_id = y.id
WHERE b.code = 'CSE' 
  AND y.display_name ILIKE '%2nd%';
```

## Specific Examples

### 1. Fetch Reminders for CSE 2nd Year Students

```sql
-- Method 1: Direct filtering using year and branch columns
SELECT 
    r.id,
    r.title,
    r.due_date,
    r.description,
    r.icon_type,
    r.status,
    r.created_at,
    r.year,
    r.branch
FROM reminders r
WHERE r.year = 2 
  AND r.branch = 'CSE'
  AND r.deleted_at IS NULL
ORDER BY r.due_date ASC, r.created_at DESC;

-- Method 2: Using joins for more robust filtering
SELECT 
    r.id,
    r.title,
    r.due_date,
    r.description,
    r.icon_type,
    r.status,
    r.created_at,
    b.name as branch_name,
    y.display_name as year_name
FROM reminders r
JOIN branches b ON r.branch = b.code
JOIN years y ON r.year = EXTRACT(YEAR FROM CURRENT_DATE) - y.batch_year + 1
WHERE b.code = 'CSE' 
  AND r.year = 2
  AND r.deleted_at IS NULL
ORDER BY r.due_date ASC, r.created_at DESC;

-- Method 3: Active reminders only (future due dates)
SELECT 
    r.id,
    r.title,
    r.due_date,
    r.description,
    r.icon_type,
    r.status,
    r.created_at
FROM reminders r
WHERE r.year = 2 
  AND r.branch = 'CSE'
  AND r.deleted_at IS NULL
  AND r.due_date >= CURRENT_DATE
ORDER BY r.due_date ASC;
```

### 2. Fetch Recent Updates for 1st Year CSE Students

```sql
-- Method 1: Direct filtering
SELECT 
    ru.id,
    ru.title,
    ru.date,
    ru.description,
    ru.created_at,
    ru.updated_at,
    ru.year,
    ru.branch
FROM recent_updates ru
WHERE ru.year = 1 
  AND ru.branch = 'CSE'
ORDER BY ru.date DESC, ru.created_at DESC;

-- Method 2: Recent updates from last 30 days
SELECT 
    ru.id,
    ru.title,
    ru.date,
    ru.description,
    ru.created_at,
    ru.year,
    ru.branch
FROM recent_updates ru
WHERE ru.year = 1 
  AND ru.branch = 'CSE'
  AND ru.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ru.date DESC, ru.created_at DESC;

-- Method 3: With admin who created the update
SELECT 
    ru.id,
    ru.title,
    ru.date,
    ru.description,
    ru.created_at,
    a.email as created_by_admin
FROM recent_updates ru
LEFT JOIN admins a ON ru.created_by = a.id
WHERE ru.year = 1 
  AND ru.branch = 'CSE'
ORDER BY ru.date DESC, ru.created_at DESC;
```

### 3. Fetch Resources for Specific Year and Branch

```sql
-- Method 1: All resources for CSE 2nd year
SELECT 
    r.id,
    r.category,
    r.subject,
    r.unit,
    r.name,
    r.description,
    r.type,
    r.url,
    r.is_pdf,
    r.date,
    r.year,
    r.branch
FROM resources r
WHERE r.year = 2 
  AND r.branch = 'CSE'
  AND r.archived = false
  AND r.deleted_at IS NULL
ORDER BY r.subject, r.unit, r.date DESC;

-- Method 2: Resources by category
SELECT 
    r.id,
    r.category,
    r.subject,
    r.unit,
    r.name,
    r.description,
    r.url,
    r.date
FROM resources r
WHERE r.year = 2 
  AND r.branch = 'CSE'
  AND r.category = 'notes' -- or 'assignments', 'previous_papers', etc.
  AND r.archived = false
  AND r.deleted_at IS NULL
ORDER BY r.subject, r.unit, r.date DESC;

-- Method 3: Using new schema relationships
SELECT 
    r.id,
    r.category,
    r.subject,
    r.unit,
    r.name,
    r.description,
    r.url,
    b.name as branch_name,
    y.display_name as year_name,
    s.semester_number
FROM resources r
JOIN branches b ON r.branch_id = b.id
JOIN years y ON r.year_id = y.id
JOIN semesters s ON r.semester_id = s.id
WHERE b.code = 'CSE' 
  AND y.display_name ILIKE '%2nd%'
  AND r.archived = false
  AND r.deleted_at IS NULL
ORDER BY r.subject, r.unit, r.date DESC;
```

### 4. Fetch Exam Schedules

```sql
-- Exams for CSE 2nd year
SELECT 
    e.id,
    e.subject,
    e.exam_date,
    e.created_at,
    e.year,
    e.branch
FROM exams e
WHERE e.year = 2 
  AND e.branch = 'CSE'
  AND e.exam_date >= CURRENT_DATE
ORDER BY e.exam_date ASC;

-- Exams for next 30 days
SELECT 
    e.id,
    e.subject,
    e.exam_date,
    e.created_at,
    a.email as created_by_admin
FROM exams e
LEFT JOIN admins a ON e.created_by = a.id
WHERE e.year = 2 
  AND e.branch = 'CSE'
  AND e.exam_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY e.exam_date ASC;
```

## Advanced Queries

### 1. Combined Dashboard Query for Student

```sql
-- Get all relevant data for a specific student
WITH student_info AS (
    SELECT s.*, b.code as branch_code, y.display_name as year_name,
           EXTRACT(YEAR FROM CURRENT_DATE) - y.batch_year + 1 as academic_year
    FROM students s
    JOIN branches b ON s.branch_id = b.id
    JOIN years y ON s.year_id = y.id
    WHERE s.email = 'student@example.com' -- Replace with actual student email
)
SELECT 
    'reminder' as data_type,
    r.id,
    r.title,
    r.due_date::text as date_field,
    r.description,
    NULL as subject,
    NULL as category
FROM reminders r, student_info si
WHERE r.year = si.academic_year 
  AND r.branch = si.branch_code
  AND r.deleted_at IS NULL
  AND r.due_date >= CURRENT_DATE

UNION ALL

SELECT 
    'recent_update' as data_type,
    ru.id,
    ru.title,
    ru.date::text as date_field,
    ru.description,
    NULL as subject,
    NULL as category
FROM recent_updates ru, student_info si
WHERE ru.year = si.academic_year 
  AND ru.branch = si.branch_code
  AND ru.date >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT 
    'exam' as data_type,
    e.id,
    e.subject as title,
    e.exam_date::text as date_field,
    NULL as description,
    e.subject,
    NULL as category
FROM exams e, student_info si
WHERE e.year = si.academic_year 
  AND e.branch = si.branch_code
  AND e.exam_date >= CURRENT_DATE

ORDER BY date_field ASC;
```

### 2. Get Data for Multiple Years/Branches

```sql
-- Resources for all CSE years
SELECT 
    r.year,
    r.category,
    COUNT(*) as resource_count,
    MAX(r.date) as latest_resource_date
FROM resources r
WHERE r.branch = 'CSE'
  AND r.archived = false
  AND r.deleted_at IS NULL
GROUP BY r.year, r.category
ORDER BY r.year, r.category;

-- Recent updates across all years for CSE
SELECT 
    ru.year,
    COUNT(*) as update_count,
    MAX(ru.date) as latest_update_date
FROM recent_updates ru
WHERE ru.branch = 'CSE'
  AND ru.date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY ru.year
ORDER BY ru.year;
```

### 3. Search Functionality

```sql
-- Search across all content types for keywords
SELECT 
    'reminder' as content_type,
    r.id,
    r.title,
    r.description,
    r.due_date as relevant_date,
    r.year,
    r.branch
FROM reminders r
WHERE r.year = 2 
  AND r.branch = 'CSE'
  AND r.deleted_at IS NULL
  AND (r.title ILIKE '%exam%' OR r.description ILIKE '%exam%')

UNION ALL

SELECT 
    'recent_update' as content_type,
    ru.id,
    ru.title,
    ru.description,
    ru.date as relevant_date,
    ru.year,
    ru.branch
FROM recent_updates ru
WHERE ru.year = 2 
  AND ru.branch = 'CSE'
  AND (ru.title ILIKE '%exam%' OR ru.description ILIKE '%exam%')

UNION ALL

SELECT 
    'resource' as content_type,
    r.id,
    r.name as title,
    r.description,
    r.date as relevant_date,
    r.year,
    r.branch
FROM resources r
WHERE r.year = 2 
  AND r.branch = 'CSE'
  AND r.archived = false
  AND r.deleted_at IS NULL
  AND (r.name ILIKE '%exam%' OR r.description ILIKE '%exam%' OR r.subject ILIKE '%exam%')

ORDER BY relevant_date DESC;
```

## Performance Considerations

### 1. Indexes for Better Performance

```sql
-- Recommended indexes for common queries
CREATE INDEX idx_reminders_year_branch ON reminders(year, branch) WHERE deleted_at IS NULL;
CREATE INDEX idx_recent_updates_year_branch ON recent_updates(year, branch);
CREATE INDEX idx_resources_year_branch ON resources(year, branch) WHERE archived = false AND deleted_at IS NULL;
CREATE INDEX idx_exams_year_branch ON exams(year, branch);

-- Date-based indexes
CREATE INDEX idx_reminders_due_date ON reminders(due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_recent_updates_date ON recent_updates(date);
CREATE INDEX idx_exams_exam_date ON exams(exam_date);
CREATE INDEX idx_resources_date ON resources(date) WHERE archived = false AND deleted_at IS NULL;
```

### 2. Query Optimization Tips

1. Always include `deleted_at IS NULL` for soft-deleted records
2. Use `archived = false` for resources to exclude archived content
3. Consider date ranges to limit result sets
4. Use specific branch codes instead of LIKE operations when possible
5. Order results by relevant dates for better user experience

### 3. Pagination for Large Result Sets

```sql
-- Example with pagination
SELECT 
    r.id,
    r.title,
    r.due_date,
    r.description
FROM reminders r
WHERE r.year = 2 
  AND r.branch = 'CSE'
  AND r.deleted_at IS NULL
ORDER BY r.due_date ASC, r.created_at DESC
LIMIT 20 OFFSET 0; -- First page, 20 items per page
```

## Common Filters and Variations

### 1. Branch Variations
```sql
-- Handle different branch naming conventions
WHERE r.branch IN ('CSE', 'CS', 'Computer Science', 'COMPUTER_SCIENCE')
-- Or use pattern matching
WHERE r.branch ILIKE '%computer%'
```

### 2. Year Handling
```sql
-- If years are stored as strings
WHERE r.year = '2'
-- If years are stored as integers
WHERE r.year = 2
-- If using batch years
WHERE EXTRACT(YEAR FROM CURRENT_DATE) - y.batch_year + 1 = 2
```

### 3. Semester-Specific Data
```sql
-- For current semester data
SELECT r.*
FROM resources r
JOIN semesters s ON r.semester_id = s.id
JOIN academic_calendar ac ON s.id = ac.current_semester_id
WHERE r.year = 2 AND r.branch = 'CSE';
```

This guide provides comprehensive examples for fetching data from your academic system. Prefer the bulk endpoint for application flows; use SQL examples for admin/reporting or diagnostics.
