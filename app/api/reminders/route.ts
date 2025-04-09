// app/api/reminders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// --- Reusable Auth Function (copied from resources route) ---
async function getSheetsClient() {
  // console.log("API Route (Reminders): Attempting to get Google Sheets client..."); // Keep logs concise if preferred
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    console.error("API Error (Reminders): Google Sheets API credentials missing.");
    throw new Error("Google Sheets API credentials missing.");
  }

  try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: email,
          private_key: key.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      const authClient = await auth.getClient();
      // console.log("API Route (Reminders): Successfully obtained Google auth client.");
      return google.sheets({ version: 'v4', auth: authClient });
  } catch (error) {
       console.error("API Error (Reminders): Failed to create Google auth client:", error);
       throw new Error("Failed to authenticate with Google Sheets API.");
  }
}
// --- End Reusable Auth Function ---

// Define the structure of a reminder item
interface Reminder {
  title: string;
  dueDate: string;
  description: string;
  iconType?: string; // Optional: To control the icon ('alert', 'clock', 'calendar', etc.)
}

export async function GET(request: Request) {
  console.log(`\nAPI Route (Reminders): Received request at ${new Date().toISOString()}`);

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // ***** IMPORTANT: Use the CORRECT sheet name for reminders! *****
  const sheetName = 'Reminders'; // <--- CHANGE THIS to the actual name of your reminders sheet tab
  // *****************************************************************
  // Adjust the range to match the columns you use in your Reminders sheet
  // Example: A=Title, B=DueDate, C=Description, D=IconType, E=Status
  const range = `${sheetName}!A:E`;

  console.log("API Route (Reminders): Using Spreadsheet ID:", spreadsheetId);
  console.log("API Route (Reminders): Using Range:", range);

  if (!spreadsheetId) {
    console.error("API Error (Reminders): GOOGLE_SHEET_ID environment variable not set.");
    return NextResponse.json({ error: 'Application configuration error - Missing Sheet ID' }, { status: 500 });
  }

  try {
    const sheets = await getSheetsClient(); // Get authenticated client

    console.log(`API Route (Reminders): Calling sheets.spreadsheets.values.get...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    console.log(`API Route (Reminders): Google Sheets API call successful.`);

    const rows = response.data.values;
    if (!rows || rows.length <= 1) { // Need at least header + 1 data row
      console.warn(`API (Reminders): No data returned from sheet ${spreadsheetId}, range ${range}. Check sheet name and if data exists beyond the header.`);
      return NextResponse.json([]); // No data found is not an error
    }
    console.log(`API Route (Reminders): Received ${rows.length} rows from Google Sheets.`);

    // --- Column Mapping (Adjust indices based on YOUR Reminders sheet) ---
    const HEADER_ROW = 0;
    const TITLE_COL = 0;       // Column A
    const DUE_DATE_COL = 1;    // Column B
    const DESC_COL = 2;        // Column C
    const ICON_TYPE_COL = 3;   // Column D (Optional)
    const STATUS_COL = 4;      // Column E (Optional: Filter for "Active")
    // --- End Column Mapping ---

    // Log header row for verification
    if (rows.length > HEADER_ROW) {
        console.log("API Route (Reminders): Sheet Headers:", rows[HEADER_ROW]);
    }

    const activeReminders: Reminder[] = [];
    console.log(`API Route (Reminders): Processing rows...`);

    for (let i = HEADER_ROW + 1; i < rows.length; i++) {
      const row = rows[i];

      // Basic check for a Title to consider it a valid row
      if (!row || row.length <= TITLE_COL || !row[TITLE_COL]) {
          // console.warn(`API Route (Reminders): Skipping row ${i + 1} due to missing title or insufficient columns.`);
          continue;
      }

      // --- Optional: Filter by Status Column ---
      // Uncomment and adjust if you use a Status column (e.g., "Active")
      // const status = row[STATUS_COL]?.trim().toLowerCase();
      // if (status !== 'active') {
      //   // console.log(`API Route (Reminders): Skipping row ${i + 1} due to status: '${status}'`);
      //   continue; // Skip if not active
      // }
      // --- End Optional Filter ---

      activeReminders.push({
        title: row[TITLE_COL]?.trim() ?? 'Untitled Reminder',
        dueDate: row[DUE_DATE_COL]?.trim() ?? '',
        description: row[DESC_COL]?.trim() ?? '',
        iconType: row[ICON_TYPE_COL]?.trim().toLowerCase() ?? 'alert', // Default to 'alert' if empty or not present
      });
    }

    console.log(`API Route (Reminders): Processing complete. Found ${activeReminders.length} active reminders.`);
    return NextResponse.json(activeReminders);

  } catch (error: any) {
    console.error('API Error (Reminders) during Google Sheets fetch or processing:', error);
    if (error.response?.data?.error) {
        console.error('Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
         if (error.response.data.error.message?.includes('Unable to parse range')) {
             console.error(`\n *** Potential Issue (Reminders): The sheet name "${sheetName}" in the range "${range}" might be incorrect or the sheet doesn't exist in spreadsheet ID "${spreadsheetId}". Double-check. ***\n`);
         } else if (error.response.data.error.status === 'PERMISSION_DENIED') {
             console.error(`\n *** Potential Issue (Reminders): Check if the service account (${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}) has 'Viewer' access to the Google Sheet (ID: ${spreadsheetId}). ***\n`);
         }
    } else {
         console.error('Error details (Reminders):', error.message); // Keep stack trace for server logs if needed
    }
    return NextResponse.json({ error: 'Failed to load reminders from data source' }, { status: 500 });
  }
}