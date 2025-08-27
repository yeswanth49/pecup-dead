# Database Architecture - Supabase (PostgreSQL)

## Overview
This application uses **Supabase (PostgreSQL)** as the primary data storage and management system. The application follows a normalized relational database design with proper foreign key relationships and Row Level Security (RLS).

## Database Schema

### Core Tables
- **`students`** - User profiles with academic information
- **`resources`** - Educational materials and documents
- **`branches`** - Academic branches/departments
- **`years`** - Academic years (batch years)
- **`semesters`** - Semester information
- **`subjects`** - Course subjects
- **`representatives`** - Representative assignments

### Supporting Tables
- **`reminders`** - Academic reminders and announcements
- **`recent_updates`** - System update logs
- **`exams`** - Examination schedules

## Authentication & Authorization
- **Authentication**: NextAuth.js with Google OAuth provider
- **Authorization**: Role-Based Access Control (RBAC) with session-based permissions
- **User Roles**: `student`, `representative`, `admin`, `superadmin`

## Data Flow

### User Registration/Login
1. User authenticates via Google OAuth
2. Profile data is stored in `students` table with proper relationships
3. Session created with user context and permissions

### Resource Management
1. Resources uploaded to Google Drive (PDFs) or Supabase Storage (images)
2. Metadata stored in `resources` table with foreign key relationships
3. Access controlled by user roles and branch/year filters

## API Architecture

### Key API Routes
- **`/api/profile`** - Student profile management (GET/POST)
- **`/api/resources`** - Resource retrieval with filtering
- **`/api/admin/*`** - Administrative functions
- **`/api/user/context`** - User context and permissions

### Data Relationships
```
students ────┐
             ├── branches
             ├── years
             └── semesters
resources ───┘
```

## Environment Variables
- `NEXTAUTH_URL` - NextAuth base URL
- `NEXTAUTH_SECRET` - NextAuth secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## File Storage
- **PDFs**: Google Drive with public sharing links
- **Images**: Supabase Storage with CDN delivery
- **Metadata**: PostgreSQL with proper indexing

## Security Features
- Row Level Security (RLS) enabled on all tables
- Server-side validation on all API endpoints
- Proper foreign key constraints
- Session-based authentication

## Key Files
- **API Routes**: `app/api/*/*.ts` - Backend logic
- **Auth Config**: `app/api/auth/[...nextauth]/route.ts` - Authentication setup
- **Database Client**: `lib/supabase.ts` - Supabase configuration
- **Types**: `lib/types.ts` - TypeScript type definitions
- **Permissions**: `lib/auth-permissions.ts` - RBAC logic 