// app/api/recent-updates/route.ts
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// --- Configuration for this specific route (Hardcoded Range) ---
const SHEET_NAME = 'updates';       // <-- Hardcoded Sheet Name for recent updates
const SHEET_COLUMNS = 'A:D';        // <-- Hardcoded Columns for recent updates
const START_ROW = 2;                // <-- Hardcoded Start Row (to skip header)
const SHEET_RANGE = `${SHEET_NAME}!${SHEET_COLUMNS}${START_ROW}`; // Combine into full range string

// --- Define the structure for a recent update item (should match frontend) ---
interface RecentUpdate {
    id: string | number;
    title: string;
    date: string;
    description?: string;
}

// --- Ensure required environment variables are defined ---
// !! Keep credentials AND the Spreadsheet ID in environment variables !!
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error("Configuration Error: Missing GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable");
}
if (!process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Configuration Error: Missing GOOGLE_PRIVATE_KEY environment variable");
}
if (!process.env.GOOGLE_SHEET_ID) { // Check for Spreadsheet ID from env
    throw new Error("Configuration Error: Missing SPREADSHEET_ID environment variable");
}

export async function GET() {
    try {
        // --- 1. Authentication (Using Environment Variables for Credentials) ---
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escaped newlines
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // --- 2. Fetch Data (Spreadsheet ID from Env, Range Hardcoded) ---
        const spreadsheetId = process.env.GOOGLE_SHEET_ID; // Get Spreadsheet ID from env
        console.log(`Workspaceing from Sheet ID: ${spreadsheetId}, Range: ${SHEET_RANGE}`); // Log for debugging

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,  // Use Spreadsheet ID from env
            range: SHEET_RANGE,            // Use hardcoded range constant
        });

        const rows = response.data.values;

        // --- 3. Process Data (Same as before) ---
        let updates: RecentUpdate[] = [];
        if (rows && rows.length) {
            updates = rows
                .filter(row => row.length > 0 && row[0])
                .map((row, index) => {
                    // Adjust indices based on your actual sheet columns (A=0, B=1, C=2, D=3)
                    const update: RecentUpdate = {
                        id: `update-${index}`, // Simple ID
                        title: row[0] || 'No Title',    // Column A
                        date: row[1] || '',           // Column B
                        description: row[2] || undefined, // Column C
                    };
                    return update;
                })
                // .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Optional sort
                .slice(0, 5); // Optional limit
        }

        // --- 4. Return Response ---
        return NextResponse.json(updates);

    } catch (error: any) {
        console.error("Error fetching from Google Sheets:", error);

        let errorMessage = "Failed to fetch recent updates.";
        let statusCode = 500;

        // Basic error checking (same as before, referencing spreadsheetId variable)
        if (error.message.includes('Configuration Error')) {
            errorMessage = "Server configuration error (check environment variables).";
        } else if (error.code === 404 || (error.errors && error.errors[0]?.reason === 'notFound')) {
             errorMessage = `Spreadsheet (ID: ${process.env.SPREADSHEET_ID}) or Range (${SHEET_RANGE}) not found. Check configuration and sheet details.`;
             statusCode = 404;
        } else if (error.code === 403 || (error.errors && error.errors[0]?.reason === 'forbidden')) {
            errorMessage = `Permission denied accessing Google Sheet (ID: ${process.env.SPREADSHEET_ID}). Check service account permissions for the sheet.`;
            statusCode = 403;
        }

        return NextResponse.json({ error: errorMessage }, { status: statusCode });
    }
}

// Optional: export const revalidate = 3600; // Revalidate every hour