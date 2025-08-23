# File Upload Debug Guide - Vercel vs Local Issue

## Problem Summary
File uploads work locally but fail in Vercel deployment with error: "The string did not match the expected pattern"

## Root Cause
Data type mismatch between form submission and database schema:
- Form sends display values (e.g., "2023 Batch", "CSE", "1")
- Database expects UUID references (e.g., "57283f9b-01a2-4789-b0c0-ed7981c67fe1")
- Vercel enforces strict validation while local environment may be more lenient

## Task List

### Phase 1: Schema Analysis and Mapping
- [ ] **Task 1.1**: Examine current form submission in `app/dev-dashboard/_components/ResourcesSection.tsx`
- [ ] **Task 1.2**: Identify all form fields that need UUID conversion
- [ ] **Task 1.3**: Create mapping functions for year, branch, and semester conversions
- [ ] **Task 1.4**: Verify database lookup tables structure and data

### Phase 2: Form Logic Updates
- [ ] **Task 2.1**: Update form submission to convert display values to UUIDs
- [ ] **Task 2.2**: Add error handling for invalid mappings
- [ ] **Task 2.3**: Test form validation locally
- [ ] **Task 2.4**: Ensure all required fields are properly mapped

### Phase 3: API Endpoint Updates
- [ ] **Task 3.1**: Update `/api/admin/resources` route to handle new schema
- [ ] **Task 3.2**: Update `/api/representative/resources` route if needed
- [ ] **Task 3.3**: Verify database insertion logic uses correct field names
- [ ] **Task 3.4**: Test API endpoints locally with new data structure

### Phase 4: Environment and Deployment
- [ ] **Task 4.1**: Check environment variables between local and Vercel
- [ ] **Task 4.2**: Verify Supabase configuration in both environments
- [ ] **Task 4.3**: Test file upload functionality in Vercel deployment
- [ ] **Task 4.4**: Monitor logs for any remaining validation errors

## Detailed Task Instructions

### Task 1.1: Examine Current Form Submission
**File**: `app/dev-dashboard/_components/ResourcesSection.tsx`
**Action**: 
1. Locate the `onSubmit` function (around line 339)
2. Identify how form data is being sent
3. Note which fields are being sent as strings vs UUIDs

**Expected Output**: List of form fields and their current data types

### Task 1.2: Identify Fields Needing UUID Conversion
**Action**:
1. Review the `resources` table schema from database analysis
2. Identify fields that expect UUID references:
   - `year_id` (not `year`)
   - `branch_id` (not `branch`) 
   - `semester_id` (not `semester`)
3. Note the current form field names vs expected database field names

**Expected Output**: Mapping of form fields to database fields

### Task 1.3: Create Mapping Functions
**Action**:
1. Create utility functions to convert display values to UUIDs
2. Functions needed:
   - `getYearId(displayName: string): string`
   - `getBranchId(code: string): string`
   - `getSemesterId(yearId: string, semesterNumber: number): string`
3. Use the lookup tables: `years`, `branches`, `semesters`

**Expected Output**: Utility functions that return UUIDs for given display values

### Task 1.4: Verify Database Lookup Tables
**Action**:
1. Confirm the structure of lookup tables
2. Verify sample data exists:
   - Years: 2021, 2022, 2023, 2024
   - Branches: CSE, AI, AIML, DS, ECE, EEE, MEC, CE
   - Semesters: 1, 2 for each year

**Expected Output**: Confirmation that lookup tables contain expected data

### Task 2.1: Update Form Submission
**Action**:
1. Modify the `onSubmit` function to use mapping functions
2. Convert form values before creating FormData:
   ```typescript
   const yearId = getYearId(year);
   const branchId = getBranchId(branch);
   const semesterId = getSemesterId(yearId, semester);
   ```
3. Update FormData to use correct field names

**Expected Output**: Form submission that sends UUIDs instead of display values

### Task 2.2: Add Error Handling
**Action**:
1. Add validation for mapping failures
2. Show user-friendly error messages if:
   - Year not found
   - Branch not found
   - Semester not found
3. Prevent form submission if mappings fail

**Expected Output**: Robust error handling for invalid form data

### Task 2.3: Test Form Validation Locally
**Action**:
1. Test form with various combinations of year/branch/semester
2. Verify UUIDs are correctly generated
3. Check that FormData contains expected values
4. Test with invalid combinations to ensure error handling works

**Expected Output**: Form works correctly locally with new logic

### Task 2.4: Ensure Required Fields
**Action**:
1. Verify all required fields are present in form
2. Check that optional fields are handled properly
3. Ensure file upload field is properly configured
4. Validate that all form data reaches the API correctly

**Expected Output**: Complete form data validation

### Task 3.1: Update Admin Resources API
**File**: `app/api/admin/resources/route.ts`
**Action**:
1. Review the POST method (around line 146)
2. Ensure it handles the new field names (`year_id`, `branch_id`, `semester_id`)
3. Verify database insertion uses correct field mapping
4. Test with sample data locally

**Expected Output**: API endpoint that accepts and processes new data structure

### Task 3.2: Update Representative Resources API
**File**: `app/api/representative/resources/route.ts`
**Action**:
1. Apply same updates as admin API
2. Ensure consistent field handling
3. Test representative upload functionality

**Expected Output**: Consistent API behavior across both endpoints

### Task 3.3: Verify Database Insertion
**Action**:
1. Check that the `insertPayload` object uses correct field names
2. Verify all required fields are included
3. Test database insertion with sample data
4. Confirm no validation errors occur

**Expected Output**: Successful database insertion with new schema

### Task 3.4: Test API Endpoints
**Action**:
1. Test both API endpoints with valid data
2. Verify file uploads work correctly
3. Check database records are created properly
4. Monitor for any remaining validation errors

**Expected Output**: Working API endpoints for file uploads

### Task 4.1: Check Environment Variables
**Action**:
1. Compare local `.env` file with Vercel environment variables
2. Verify Supabase configuration is identical
3. Check for any missing or different environment variables
4. Ensure `ALLOWED_UPLOAD_MIME_TYPES` and `ALLOWED_UPLOAD_EXTENSIONS` are set

**Expected Output**: Identical environment configuration between local and Vercel

### Task 4.2: Verify Supabase Configuration
**Action**:
1. Confirm Supabase project URL and keys are correct
2. Verify RLS policies are consistent
3. Check that storage buckets are accessible
4. Ensure Google Drive integration is configured

**Expected Output**: Confirmed Supabase configuration consistency

### Task 4.3: Test Vercel Deployment
**Action**:
1. Deploy updated code to Vercel
2. Test file upload functionality in production
3. Verify no more "pattern mismatch" errors
4. Confirm files are uploaded successfully

**Expected Output**: Working file uploads in Vercel deployment

### Task 4.4: Monitor and Debug
**Action**:
1. Check Vercel function logs for errors
2. Monitor Supabase logs for any issues
3. Verify file storage is working correctly
4. Document any remaining issues

**Expected Output**: Complete resolution of file upload issues

## Success Criteria
- [ ] File uploads work in both local and Vercel environments
- [ ] No "string did not match expected pattern" errors
- [ ] All form data is properly converted to UUIDs
- [ ] Database records are created successfully
- [ ] Files are stored in appropriate locations (Supabase Storage/Google Drive)

## Notes for AI Agent
- Work through tasks sequentially
- Test each change locally before proceeding
- Use the database schema analysis from the conversation
- Focus on data type conversion, not file upload logic
- Keep changes minimal and focused on the specific issue
