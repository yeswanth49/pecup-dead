# Database Handling in the Application

## Overview
This application does not use a traditional database like PostgreSQL or MongoDB. Instead, it leverages Google Sheets as the primary data storage and management system. Data operations are performed via the Google Sheets API in the backend API routes.

## Authentication and Setup
- The application uses a Google Service Account for authentication.
- Credentials (client email, private key) are stored in environment variables (e.g., `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`).
- The `googleapis` library is used to create an authenticated client for the Sheets API v4.
- Scopes are set to `'https://www.googleapis.com/auth/spreadsheets.readonly'` for read operations and `'https://www.googleapis.com/auth/spreadsheets'` for write operations.

## Data Fetching
- API routes (e.g., `/api/reminders`, `/api/recent-updates`, `/api/prime-section-data`, `/api/resources`) fetch data from specific Google Spreadsheets.
- Spreadsheet IDs are sourced from environment variables (e.g., `GOOGLE_SHEET_ID`).
- Data is retrieved using `sheets.spreadsheets.values.get` method, specifying the spreadsheet ID and range.
- Fetched data (rows) is processed (filtered, mapped) into JSON format and returned to the client.

## Data Writing
- In the `/api/uploadResource` route, new resources are appended to the spreadsheet using `sheets.spreadsheets.values.append`.
- This allows adding new rows to the sheet with details like category, subject, unit, resource name, URL, etc.

## User Authentication
- User authentication is handled via NextAuth with Google Provider.
- No database adapter is used, so sessions are managed with JWT (JSON Web Tokens).
- User data is not persisted in a database; it's handled ephemerally through authentication tokens.

## Key Files
- **API Routes**: `app/api/*/*.ts` (e.g., `reminders/route.ts`, `resources/route.ts`) contain the logic for interacting with Google Sheets.
- **Auth Configuration**: `app/api/auth/[...nextauth]/route.ts` sets up NextAuth without a database adapter.

## Notes
- This approach treats Google Sheets as a lightweight, no-setup database alternative, suitable for small-scale data management.
- For production or scaling, consider migrating to a dedicated database for better performance and features.
- Ensure environment variables for Google credentials and sheet IDs are properly set.
- Error handling includes logging and returning appropriate HTTP responses for failures in authentication or API calls. 