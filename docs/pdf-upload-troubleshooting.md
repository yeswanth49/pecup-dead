# PDF Upload Troubleshooting Guide for Dev Dashboard

This document outlines potential causes and troubleshooting steps for issues encountered when uploading PDF files via the Dev Dashboard, specifically focusing on the server-side logic.

## Understanding the Upload Flow

1.  **Client-Side (Dev Dashboard Form):** The `ResourceUploadForm.tsx` component handles file selection. It does **not** perform client-side file type validation, meaning any file type can be selected and sent to the server.
2.  **Server-Side API (`/api/uploadResource`):** This Next.js API route (`app/api/uploadResource/route.ts`) is responsible for:
    *   Receiving the uploaded file and other form data.
    *   Performing server-side validation (file size, type).
    *   **Crucially, it differentiates between PDF and non-PDF files:**
        *   **PDFs (`.pdf` or `application/pdf` MIME type) are uploaded to Google Drive.**
        *   **Non-PDFs are uploaded to Supabase Storage.**
    *   Saving resource metadata (title, description, URL, etc.) to the Supabase database.

## Potential Root Causes and Troubleshooting Steps

Based on the codebase analysis, here are the most likely reasons for PDF upload failures:

### 1. File Size Exceeds Limit (HTTP Status: 413)

**Cause:** The server has a hard limit for file uploads to prevent memory issues.
**Limit:** `MAX_UPLOAD_BYTES` is set to **25 MB**.

**Troubleshooting:**
*   **Check File Size:** Before attempting to upload, verify the size of your PDF file. If it's larger than 25 MB, it will be rejected.
*   **Error Message:** The API will return an error message like: `"File too large. Please upload a smaller file."`

### 2. File Type Validation Failure (HTTP Status: 415)

**Cause:** Although the client-side doesn't restrict file types, the server-side `validateFile` function (`lib/file-validation.ts`) performs a rigorous check. This function verifies:
    *   **Magic Bytes:** It attempts to identify the file type by reading the first few bytes (e.g., `%PDF-` for PDFs). This is the most reliable method.
    *   **Client-Provided MIME Type:** The MIME type sent by the browser (e.g., `application/pdf`).
    *   **File Extension:** The file's extension (e.g., `.pdf`).

**Default Allowed Types:** By default, the system allows:
*   MIME Types: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`
*   Extensions: `pdf`, `png`, `jpg`, `jpeg`, `webp`

**Troubleshooting:**
*   **Corrupted PDF:** Ensure the PDF file is not corrupted. A corrupted file might not have the correct magic bytes, leading to validation failure.
*   **Environment Variables:** Check if the environment variables `ALLOWED_UPLOAD_MIME_TYPES` or `ALLOWED_UPLOAD_EXTENSIONS` are set on your server. If they are, ensure they explicitly include `application/pdf` and `pdf` respectively.
    *   Example: `ALLOWED_UPLOAD_MIME_TYPES="application/pdf,image/png"`
    *   Example: `ALLOWED_UPLOAD_EXTENSIONS="pdf,png"`
*   **Server Logs:** Look for warnings in the server logs (prefixed with `[API DEBUG UploadResource]`) indicating:
    *   `File rejected by whitelist. Name='...', Ext='...', Client MIME='...', Detected='...', Reason='...'`
    *   The `Reason` field will tell you why it was rejected (e.g., "Disallowed file signature", "File extension and MIME type are not allowed").

### 3. Google Drive Configuration Issues (HTTP Status: 500)

**Cause:** PDF uploads rely on Google Drive integration. If the necessary environment variables for Google Drive authentication and folder identification are missing or incorrect, the upload will fail.

**Troubleshooting:**
*   **`GOOGLE_DRIVE_FOLDER_ID` Missing/Invalid:**
    *   **Check Environment Variable:** Ensure `GOOGLE_DRIVE_FOLDER_ID` is set in your server's environment variables. This should be the ID of the specific Google Drive folder where you want to store the PDFs.
    *   **Folder Permissions:** The Google Service Account (associated with your credentials) must have **write access** to this Google Drive folder.
    *   **Server Logs:** Look for errors like: `API Config Error: GOOGLE_DRIVE_FOLDER_ID not set.` or `Server configuration error: Drive folder ID missing.`
*   **Google Service Account Credentials Missing/Invalid:**
    *   **Check Environment Variables:** You must have either `GOOGLE_APPLICATION_CREDENTIALS_B64` (base64 encoded JSON) or `GOOGLE_APPLICATION_CREDENTIALS_JSON` (raw JSON string) set. These contain the credentials for your Google Service Account.
    *   **Credential Format:** Ensure the JSON content is valid and correctly formatted. If using `_B64`, ensure it's correctly base64 encoded.
    *   **Service Account API Access:** Verify that the Google Service Account has the necessary Google Drive API permissions enabled in the Google Cloud Console. The required scope is `https://www.googleapis.com/auth/drive.file`.
    *   **Server Logs:** Look for errors like:
        *   `API Setup Error: Google credentials not set or empty.`
        *   `Failed to decode GOOGLE_APPLICATION_CREDENTIALS_B64:`
        *   `Failed to parse Google credentials JSON.`
        *   `Error during Google Auth Client initialization:`

### 4. Google Drive Public Permissions Failure (HTTP Status: 500)

**Cause:** After a PDF is uploaded to Google Drive, the system attempts to set its permissions to `role: 'reader', type: 'anyone'` to make it publicly accessible. If this step fails, the system will roll back the upload (delete the file from Drive) and report an error.

**Troubleshooting:**
*   **Service Account Permissions:** Ensure your Google Service Account has the necessary permissions to manage file permissions on Google Drive.
*   **Google Drive API Quotas:** While less common, check if your Google Drive API usage has hit any quotas.
*   **Server Logs:** Look for critical errors like:
    *   `ERROR: Failed to set public permissions for file ...`
    *   `Rolled back Google Drive upload due to permissions failure. Deleted file ...`
    *   `Failed to set public permissions on uploaded file. Upload has been rolled back.`

### 5. Authorization Failure (HTTP Status: 403)

**Cause:** The API endpoint checks if the uploading user's email is in the `AUTHORIZED_EMAILS` environment variable. If not, the upload is forbidden.

**Troubleshooting:**
*   **`AUTHORIZED_EMAILS` Configuration:** Ensure the `AUTHORIZED_EMAILS` environment variable is set and includes the email address of the user attempting the upload. It should be a comma-separated list.
    *   Example: `AUTHORIZED_EMAILS="user1@example.com,admin@example.com"`
*   **User Login:** Verify that the user is properly logged in and their session contains their email.
*   **Server Logs:** Look for warnings like: `Unauthorized access attempt by ... Not in authorized list.`

## General Troubleshooting Steps (Always Check)

*   **Check Server Logs:** This is the most critical step. The `app/api/uploadResource/route.ts` file includes extensive `console.log` statements with the `[API DEBUG UploadResource]` prefix. These logs will provide precise details about where the upload process failed and why.
*   **Network Tab in Browser Developer Tools:** When an upload fails, open your browser's developer tools (usually F12), go to the "Network" tab, and inspect the request made to `/api/uploadResource`. Look at the response status code (e.g., 400, 403, 413, 415, 500) and the response body for specific error messages. This will help narrow down the issue.

By systematically checking these points, you should be able to identify the root cause of your PDF upload issues.
