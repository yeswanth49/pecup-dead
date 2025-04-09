import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path'; // Keep path if needed for other things, not strictly for env vars

// Define the structure of a resource item returned by the API
interface Resource {
  name: string;
  description: string;
  date: string;
  type: string;
  url: string;
}

// Function to authenticate and get sheets API client
async function getSheetsClient() {
  console.log("API Route: Attempting to get Google Sheets client..."); // LOG: Start auth
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    console.error("API Error: Google Sheets API credentials (email or key) missing in environment variables."); // LOG: Creds missing
    throw new Error("Google Sheets API credentials missing in environment variables.");
  } else {
    console.log("API Route: Found GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables."); // LOG: Creds found
  }

  try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: email,
          private_key: key.replace(/\\n/g, '\n'), // Handle newlines
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      const authClient = await auth.getClient();
      console.log("API Route: Successfully obtained Google auth client."); // LOG: Auth success
      return google.sheets({ version: 'v4', auth: authClient });
  } catch (error) {
       console.error("API Error: Failed to create Google auth client:", error); // LOG: Auth failure
       throw new Error("Failed to authenticate with Google Sheets API."); // Re-throw for outer catch
  }
}

export async function GET(request: Request) {
  console.log(`\nAPI Route: Received request at ${new Date().toISOString()}`); // LOG: Request start

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category')?.toLowerCase();
  const encodedSubject = searchParams.get('subject');
  const unit = searchParams.get('unit');

  // LOG: Received parameters
  console.log(`API Route: Query Params - category: ${category}, encodedSubject: ${encodedSubject}, unit: ${unit}`);

  // --- Parameter Validation ---
  if (!category || !encodedSubject || !unit) {
    console.warn("API Route: Missing required query parameters."); // LOG: Validation fail
    return NextResponse.json({ error: 'Missing required query parameters: category, subject, unit' }, { status: 400 });
  }

  let subject = ''; // lowercase, decoded: "dbms", "p&s"
  try {
    subject = decodeURIComponent(encodedSubject);
    console.log(`API Route: Decoded subject: ${subject}`); // LOG: Decoded subject
  } catch (error) {
    console.error(`API Route: Invalid subject parameter encoding: ${encodedSubject}`, error); // LOG: Decode fail
    return NextResponse.json({ error: 'Invalid subject parameter encoding' }, { status: 400 });
  }

  const unitNumber = parseInt(unit, 10);
  if (isNaN(unitNumber) || unitNumber <= 0) {
    console.warn(`API Route: Invalid unit number: ${unit}`); // LOG: Validation fail
    return NextResponse.json({ error: 'Invalid unit number' }, { status: 400 });
  }
   console.log(`API Route: Parsed unit number: ${unitNumber}`); // LOG: Parsed unit
  // --- End Parameter Validation ---

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  // ***** IMPORTANT: Use the CORRECT sheet name here! *****
  const sheetName = 'pecup'; // <--- Make ABSOLUTELY SURE 'fun' is the exact name of your sheet tab
  // *********************************************************
  const range = `${sheetName}!A:H`; // Construct range dynamically

  // LOG: Values being used for API call
  console.log("API Route: Using Spreadsheet ID:", spreadsheetId);
  console.log("API Route: Using Range:", range);

  if (!spreadsheetId) {
    console.error("API Error: GOOGLE_SHEET_ID environment variable not set."); // LOG: Config error
    return NextResponse.json({ error: 'Application configuration error - Missing Sheet ID' }, { status: 500 });
  }

  try {
    const sheets = await getSheetsClient(); // Get authenticated client

    console.log(`API Route: Calling sheets.spreadsheets.values.get...`); // LOG: Before API call

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    console.log(`API Route: Google Sheets API call successful.`); // LOG: API call success

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      // This is NOT an error, just means the sheet/range is empty or doesn't exist in a way that returns values
      console.warn(`API: No data returned from sheet ${spreadsheetId}, range ${range}. Check sheet name and if data exists.`); // LOG: Empty response
      return NextResponse.json([]); // No data found
    }
    console.log(`API Route: Received ${rows.length} rows from Google Sheets.`); // LOG: Row count

    // --- Column Mapping (adjust indices based on your sheet) ---
    const HEADER_ROW = 0;
    const CATEGORY_COL = 0; // A
    const SUBJECT_COL = 1;  // B
    const UNIT_COL = 2;     // C
    const NAME_COL = 3;     // D
    const DESC_COL = 4;     // E
    const DATE_COL = 5;     // F
    const TYPE_COL = 6;     // G
    const URL_COL = 7;      // H
    // --- End Column Mapping ---

    // Log header row if possible (helps verify column order)
    if(rows.length > HEADER_ROW) {
        console.log("API Route: Sheet Headers:", rows[HEADER_ROW]);
    }


    const filteredResources: Resource[] = [];
    console.log(`API Route: Filtering rows for category='${category}', subject='${subject}', unit=${unitNumber}`); // LOG: Filtering criteria

    for (let i = HEADER_ROW + 1; i < rows.length; i++) {
      const row = rows[i];
      // Log first few rows being processed
      if (i < HEADER_ROW + 4) {
          console.log(`API Route: Processing row ${i + 1}:`, row);
      }

      // Check for minimum expected columns based on mappings
      const maxIndex = Math.max(CATEGORY_COL, SUBJECT_COL, UNIT_COL, NAME_COL, DESC_COL, DATE_COL, TYPE_COL, URL_COL);
      if (!row || row.length <= maxIndex) {
          console.warn(`API Route: Skipping row ${i + 1} due to insufficient columns (needs at least ${maxIndex + 1}, has ${row?.length || 0})`); // LOG: Malformed row
          continue;
      }

      const rowCategory = row[CATEGORY_COL]?.trim().toLowerCase(); // Trim whitespace and normalize case
      const rowSubject = row[SUBJECT_COL]?.trim().toLowerCase(); // Trim whitespace and normalize case
      const rowUnit = parseInt(row[UNIT_COL], 10);

      // Log the comparison values for a specific row if needed for debugging
      // if(i === 1) { // Example: Log details for the first data row
      //    console.log(`Row ${i+1} comparison: Req:[${category}, ${subject}, ${unitNumber}] vs Row:[${rowCategory}, ${rowSubject}, ${rowUnit}]`);
      // }

      // Filter rows matching the request
      if (
        rowCategory === category &&
        rowSubject === subject &&
        !isNaN(rowUnit) && // Make sure unit parsed correctly
        rowUnit === unitNumber
      ) {
         console.log(`API Route: Row ${i + 1} MATCHED! Adding resource: ${row[NAME_COL]}`); // LOG: Match found
         filteredResources.push({
           name: row[NAME_COL] ?? 'Untitled Resource',
           description: row[DESC_COL] ?? '',
           date: row[DATE_COL] ?? '',
           type: row[TYPE_COL] ?? '', // Ensure these indices are correct for your sheet!
           url: row[URL_COL] ?? '#',
         });
      }
    }

    console.log(`API Route: Filtering complete. Found ${filteredResources.length} matching resources.`); // LOG: Filter result count
    return NextResponse.json(filteredResources);

  } catch (error: any) {
    // Log more detailed error information
    console.error('API Error during Google Sheets fetch or processing:', error); // LOG: Catch block error object
    if (error.response?.data?.error) {
        // Log specific Google API error details if available
        console.error('Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
        if (error.response.data.error.message?.includes('Unable to parse range')) {
             console.error(`\n *** Potential Issue: The sheet name "${sheetName}" in the range "${range}" might be incorrect or the sheet doesn't exist in spreadsheet ID "${spreadsheetId}". Double-check capitalization, spaces, and spelling in your Google Sheet document. ***\n`);
        } else if (error.response.data.error.status === 'PERMISSION_DENIED') {
             console.error(`\n *** Potential Issue: Check if the service account email (${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}) has 'Viewer' access to the Google Sheet document (ID: ${spreadsheetId}). ***\n`);
        }
    } else {
         console.error('Error details:', error.message, error.stack);
    }
    return NextResponse.json({ error: 'Failed to load resources from data source' }, { status: 500 });
  }
}