# Database Handling in the Application

## Overview
This application now uses Supabase (PostgreSQL) as the primary data storage and management system. Some uploads continue to use Google Drive for PDFs, while Supabase Storage is used for non-PDF files. Data operations are performed via the Supabase client in the backend API routes.

## Authentication and Setup
- The application uses a Google Service Account for authentication.
- Credentials (client email, private key) are stored in environment variables (e.g., `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`).
- The `googleapis` library is used to create an authenticated client for the Sheets API v4.
- Scopes are set to `'https://www.googleapis.com/auth/spreadsheets.readonly'` for read operations and `'https://www.googleapis.com/auth/spreadsheets'` for write operations.

## Data Fetching
- API routes (e.g., `/api/reminders`, `/api/recent-updates`, `/api/prime-section-data`, `/api/resources`) fetch data from Supabase tables (`reminders`, `recent_updates`, `exams`, `resources`).
- Supabase URL and keys are sourced from environment variables.
- Queries use RLS-safe server-side admin client.

## Data Writing
- In the `/api/admin/resources` route, new resources are inserted into the `resources` table. PDFs are uploaded to Drive; other files to Supabase Storage. URLs are saved in the DB.

## User Authentication & RBAC
- User authentication is handled via NextAuth with Google Provider. Sessions are JWT-based.
- User profiles are persisted in the `profiles` table with fields: `email`, `name`, `year`, `branch`, `roll_number`, `role`.
- Role-based access:
  - Students (`role = student`) automatically see content filtered by their `year` and `branch`.
  - Admins are in the `admins` table with `role` `admin` or `superadmin`. Optional `admin_scopes` rows restrict which `(year, branch)` they can manage.

## Key Files
- **API Routes**: `app/api/*/*.ts` (e.g., `reminders/route.ts`, `resources/route.ts`) contain the logic for interacting with Supabase.
- **Auth Configuration**: `app/api/auth/[...nextauth]/route.ts` sets up NextAuth.
 - **Subjects API**: `app/api/subjects/route.ts` fetches contextual subject lists from `subject_offerings` and `subjects` tables based on year/branch/semester.

## Notes
- This approach treats Google Sheets as a lightweight, no-setup database alternative, suitable for small-scale data management.
- For production or scaling, consider migrating to a dedicated database for better performance and features.
- Ensure environment variables for Google credentials and sheet IDs are properly set.
- Error handling includes logging and returning appropriate HTTP responses for failures in authentication or API calls. 