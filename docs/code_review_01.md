In app/api/profile/route.ts around lines 212-218, remove the unsafe "any" assertions and access nested properties with proper typing: give the handler's "data" a precise type (or define a small Year/Branch sub-type), then use optional chaining (data.year?.batch_year and data.branch?.code) and pass those typed values to mapBatchYearToYearLevel or fallback to '' for branch; in short, replace the (data.year as any)?.batch_year and (data.branch as any)?.code usages with correctly typed accesses by declaring/using the appropriate interfaces or type guards instead of "any".



In app/api/profile/route.ts around lines 96 to 106, the code accesses nested properties using unsafe type assertions (data.year as any)?.batch_year and (data.branch as any)?.code; replace these with proper runtime null/undefined checks or refine the data type so you don't cast to any: first ensure data is non-null, then check data.year and typeof data.year.batch_year before calling mapBatchYearToYearLevel, and check data.branch and typeof data.branch.code before reading it; provide safe fallbacks (e.g., undefined or empty string) when those nested fields are missing so you avoid runtime errors and remove the any casts.



In app/api/profile/route.ts around lines 64 to 68, the GET handler creates a new Supabase admin client with createSupabaseAdmin(), but a top-level supabaseAdmin was already created at line 11 and left unused; either reuse that top-level supabaseAdmin here instead of calling createSupabaseAdmin() again, or remove the top-level supabaseAdmin declaration at line 11 if you prefer creating the client inside the handler. Update the code so only one Supabase admin instance is created and referenced (adjust any imports/exports accordingly) and remove the unused variable to avoid redundancy and linter errors.



In app/api/profile/route.ts at line 11, remove the unused top-level declaration `const supabaseAdmin = createSupabaseAdmin();` because both endpoint handlers instantiate their own Supabase admin clients; delete this line and, if the createSupabaseAdmin import is now unused, remove that import as well to avoid lint errors.



In app/api/profile/route.ts around lines 14 to 23, the batch-year-to-year-level mapping is hardcoded; replace it with a configurable/dynamic calculation: compute the current reference year (e.g., new Date().getFullYear(), optionally adjusted for academic start month from config), then derive yearLevel as (currentYear - batchYear) + 1 with bounds checking (min 1, max configured program length); alternatively allow overriding via a config map or DB lookup injected into this module so future year changes don’t require code edits.




In lib/auth-permissions.ts around line 109, the code currently hardcodes role: 'student' which ignores the actual role coming from the database and prevents any 'representative' matches; change the assignment to read the role from the student record (e.g., role: student.role as UserRole) and include a safe fallback (e.g., default to 'student' only if student.role is missing or invalid), ensuring the variable type matches UserRole so the existing representative check on line 65 can work correctly.




In lib/auth-permissions.ts around lines 40 to 60 the students select query omits the role field but later code checks student.role; update the SELECT to include role (e.g., add role to the selected columns alongside id, roll_number, name, email, etc.) so student.role is populated when the row is returned.



In docs/database_info.md around lines 56 to 64, the environment variable list exposes SUPABASE_SERVICE_ROLE_KEY which must never be sent to the browser; modify the section to split env vars into two subsections "Server-only environment variables" and "Public/client environment variables (NEXT_PUBLIC_*)" and move SUPABASE_SERVICE_ROLE_KEY under server-only only, mark SUPABASE_ANON_KEY and NEXTAUTH_* as appropriate for public vs server (e.g., use NEXT_PUBLIC_* for any safe client values), and add a short warning that service role keys must never be included in client builds or exposed to frontend code.




In docs/database_info.md around lines 65 to 69, the guidance currently lists PDFs stored on Google Drive with public sharing links; update this to use Supabase Storage with time-limited signed URLs instead. Replace the Google Drive/public links entry with instructions to store PDFs in Supabase Storage, enable appropriate bucket policies, generate expiring signed URLs for client access, and ensure any references or docs mention using the Supabase SDK to create and revoke signed URLs so files remain behind RBAC/RLS and are not publicly accessible.