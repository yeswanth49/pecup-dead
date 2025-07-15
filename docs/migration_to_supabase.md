# Migration to Supabase: Information Context

## Current Setup
The application currently uses Google Sheets as the primary data store for metadata and Google Drive for file storage. Key aspects include:

- **Data Storage in Google Sheets**: Multiple sheets/tabs store different types of data.
  - Resources (sheet: 'pecup'): Columns for Category, Subject, Unit, Resource Name, Description, Date, Type, URL (Google Drive link).
  - Reminders (sheet: 'Reminders'): Columns for Title, Due Date, Description, Icon Type, Status.
  - Other sheets likely for recent updates and prime section data (similar structure).
- **File Storage in Google Drive**: All uploaded files (including PDFs and others) are stored in a specific Google Drive folder. Public links are generated and stored in Sheets.
- **API Routes**: Backend routes (e.g., `/api/resources`, `/api/reminders`, `/api/uploadResource`) handle authentication, data fetching (using `googleapis`), filtering, and appending new data/ files.
- **Authentication**: Google Service Account for Sheets and Drive access. Environment variables store credentials.
- **Uploads**: Files are uploaded to Drive, metadata appended to Sheets. Supports any file type, but URLs point to Drive.

## Proposed Migration Plan
Migrate metadata (indexing) from Google Sheets to Supabase PostgreSQL tables. For files:
- Keep PDFs in Google Drive (store Drive URLs in Supabase).
- Store non-PDF files in Supabase Storage (store Supabase URLs in the database).

This provides better querying, scalability, and integration while retaining Drive for PDFs if desired (e.g., for existing integrations).

### Step 1: Set Up Supabase
- Create a Supabase project.
- Install Supabase client library: `npm install @supabase/supabase-js`.
- Add Supabase URL and Anon Key to environment variables.

### Step 2: Database Schema Design
Create tables mirroring Sheets structure. Example:

- **resources** table:
  - id (uuid, primary key)
  - category (text)
  - subject (text)
  - unit (integer)
  - name (text)
  - description (text)
  - date (timestamp)
  - type (text)
  - url (text)  // Drive URL for PDFs, Supabase Storage URL for others
  - is_pdf (boolean)  // Flag to indicate storage location

- **reminders** table:
  - id (uuid, primary key)
  - title (text)
  - due_date (date)
  - description (text)
  - icon_type (text)
  - status (text)

- Similar tables for other data (e.g., recent_updates, prime_section_data).

Use Supabase's PostgreSQL features for indexing, foreign keys if needed.

### Step 3: Data Migration
- Export data from each Google Sheet as CSV.
- Import CSVs into corresponding Supabase tables using Supabase dashboard or SQL scripts.
- For existing files:
  - If PDF, keep in Drive, update URL in Supabase.
  - If non-PDF, download from Drive, upload to Supabase Storage, update URL.
- Script this migration using Node.js with `googleapis` and `@supabase/supabase-js`.

### Step 4: Update API Routes
- Replace Google Sheets API calls with Supabase queries.
- For fetching (e.g., GET /api/resources):
  - Use Supabase client to query tables with filters (e.g., `select * from resources where category = ? and subject = ? and unit = ?`).
- For uploads (e.g., POST /api/uploadResource):
  - Check if file is PDF (based on mimeType or extension).
  - If PDF: Upload to Google Drive, get public URL.
  - If non-PDF: Upload to Supabase Storage, get signed URL.
  - Insert metadata into Supabase table with appropriate URL.
- Remove Google auth code; use Supabase client instead.

### Step 5: Update Frontend
- Ensure components like ResourceUploadForm use updated API endpoints.
- Handle any changes in data formats if applicable.

### Considerations
- **Security**: Use Row Level Security (RLS) in Supabase for access control.
- **Performance**: Supabase queries are faster than Sheets API for large datasets.
- **Costs**: Monitor Supabase usage; Drive remains for PDFs.
- **Backup**: Set up Supabase backups; existing Drive files remain.
- **Testing**: Test migration in a staging environment. Verify all data types, especially dates and URLs.
- **Dependencies**: Keep `googleapis` for Drive uploads (PDFs only); add Supabase lib.
- **Environment Variables**: Add SUPABASE_URL, SUPABASE_ANON_KEY; retain Google creds for Drive.

This migration enhances the app's data management while selectively using Drive for PDFs. 