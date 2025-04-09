// app/api/uploadResource/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route'; // Make sure this path is correct
import { google } from 'googleapis';
import { Readable } from 'stream';

// --- Enhanced Debug Logging Prefix ---
const DEBUG_PREFIX = '[API DEBUG UploadResource]';

// --- Environment Variables ---
console.log(`${DEBUG_PREFIX} Initializing: Checking environment variables...`);
console.log(`${DEBUG_PREFIX} AUTHORIZED_EMAILS set:`, !!process.env.AUTHORIZED_EMAILS);
console.log(`${DEBUG_PREFIX} GOOGLE_DRIVE_FOLDER_ID set:`, !!process.env.GOOGLE_DRIVE_FOLDER_ID);
console.log(`${DEBUG_PREFIX} GOOGLE_SHEET_ID set:`, !!process.env.GOOGLE_SHEET_ID);
console.log(`${DEBUG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS_JSON set:`, !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

const authorizedEmails = (process.env.AUTHORIZED_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

async function getGoogleAuthClient() {
  const FN_DEBUG_PREFIX = `${DEBUG_PREFIX} [getGoogleAuthClient]`;
  try {
    console.log(`${FN_DEBUG_PREFIX} Attempting to get Google Auth Client...`);
    const credentialsJSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    console.log(`${FN_DEBUG_PREFIX} Type of GOOGLE_CREDENTIALS_JSON:`, typeof credentialsJSON);
    if (typeof credentialsJSON === 'string') {
        console.log(`${FN_DEBUG_PREFIX} Length of GOOGLE_CREDENTIALS_JSON string:`, credentialsJSON.length);
    } else {
        console.log(`${FN_DEBUG_PREFIX} GOOGLE_CREDENTIALS_JSON is not a string or is undefined.`);
    }

    if (!credentialsJSON || typeof credentialsJSON !== 'string' || credentialsJSON.trim() === '') {
      console.error(`${FN_DEBUG_PREFIX} API Setup Error: GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set or empty.`);
      throw new Error('Server configuration error: Google credentials missing or invalid.');
    }

    let credentials;
    try {
        console.log(`${FN_DEBUG_PREFIX} Attempting to parse GOOGLE_CREDENTIALS_JSON...`);
        credentials = JSON.parse(credentialsJSON);
        console.log(`${FN_DEBUG_PREFIX} Successfully parsed GOOGLE_CREDENTIALS_JSON.`);
        console.log(`${FN_DEBUG_PREFIX} Parsed credentials contain keys: client_email=${!!credentials.client_email}, private_key=${!!credentials.private_key ? 'Exists (length hidden)' : 'MISSING!'}, project_id=${credentials.project_id}`);
    } catch (parseError: any) {
        console.error(`${FN_DEBUG_PREFIX} API Setup Error: Failed to parse Google credentials JSON.`, parseError.message);
        console.error(`${FN_DEBUG_PREFIX} JSON Parse Error Details:`, parseError);
        console.error(`${FN_DEBUG_PREFIX} Problematic JSON String (first 100 chars):`, credentialsJSON.substring(0, 100) + '...');
        throw new Error('Server configuration error: Invalid Google credentials format.');
    }

    console.log(`${FN_DEBUG_PREFIX} Initializing google.auth.GoogleAuth with credentials and scopes:`, SCOPES);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    console.log(`${FN_DEBUG_PREFIX} Attempting to get client from auth object...`);
    const client = await auth.getClient();
    console.log(`${FN_DEBUG_PREFIX} Google Auth Client obtained successfully.`);
    return client;

  } catch (error: any) {
    console.error(`${FN_DEBUG_PREFIX} Error during Google Auth Client initialization:`, error.message);
    console.error(`${FN_DEBUG_PREFIX} Full error object:`, error);
    throw new Error(`Server configuration error during auth setup: ${error.message}`);
  }
}

async function getAuthorizedUser() {
  const FN_DEBUG_PREFIX = `${DEBUG_PREFIX} [getAuthorizedUser]`;
  console.log(`${FN_DEBUG_PREFIX} Attempting to get server session...`);
  const session = await getServerSession(authOptions);

  if (!session) {
    console.log(`${FN_DEBUG_PREFIX} No active session found.`);
    return null;
  }
  console.log(`${FN_DEBUG_PREFIX} Session found. User email:`, session?.user?.email);

  if (!session.user?.email) {
    console.log(`${FN_DEBUG_PREFIX} Session exists but user email is missing.`);
    return null;
  }

  const userEmail = session.user.email;
  console.log(`${FN_DEBUG_PREFIX} Checking if user email '${userEmail}' is in authorized list:`, authorizedEmails);
  if (!authorizedEmails.includes(userEmail)) {
    console.warn(`${FN_DEBUG_PREFIX} Unauthorized access attempt by ${userEmail}. Not in authorized list.`);
    return null;
  }

  console.log(`${FN_DEBUG_PREFIX} Authorized access granted to ${userEmail}.`);
  return session.user;
}

export async function POST(request: Request) {
  const REQ_DEBUG_PREFIX = `${DEBUG_PREFIX} [POST Request]`;
  console.log(`${REQ_DEBUG_PREFIX} Received POST request at ${new Date().toISOString()}`);

  // 1. Authorization Check
  let authorizedUser;
  try {
      authorizedUser = await getAuthorizedUser();
      if (!authorizedUser || !authorizedUser.email) {
        console.warn(`${REQ_DEBUG_PREFIX} Authorization failed.`);
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      console.log(`${REQ_DEBUG_PREFIX} Authorization successful for user: ${authorizedUser.email}`);
  } catch (authError: any) {
      console.error(`${REQ_DEBUG_PREFIX} Error during authorization check:`, authError.message);
      console.error(`${REQ_DEBUG_PREFIX} Full authorization error:`, authError);
      return NextResponse.json({ error: 'Internal server error during authorization.', details: authError.message }, { status: 500 });
  }

  // 2. Google Authentication
  let authClient;
  try {
    authClient = await getGoogleAuthClient();
    console.log(`${REQ_DEBUG_PREFIX} Google Auth Client successfully obtained.`);
  } catch (authSetupError: any) {
    console.error(`${REQ_DEBUG_PREFIX} Failed to get Google Auth Client:`, authSetupError.message);
    console.error(`${REQ_DEBUG_PREFIX} Full Google Auth Client error:`, authSetupError);
    return NextResponse.json({ error: 'Server configuration error related to Google Authentication.', details: authSetupError.message }, { status: 500 });
  }

  // Main Upload Logic
  try {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const formData = await request.formData();
    console.log(`${REQ_DEBUG_PREFIX} FormData keys found:`, Array.from(formData.keys()));

    // --- Extract existing and NEW form fields ---
    const file: File | null = formData.get('theFile') as File | null;
    const title = formData.get('title') as string | null; // Corresponds to "Resource Name"
    const description = formData.get('description') as string | null; // Corresponds to "Resource Description"
    const category = formData.get('category') as string | null; // Corresponds to "Category"
    const subject = formData.get('subject') as string | null; // <-- NEW FIELD
    const unit = formData.get('unit') as string | null; // <-- NEW FIELD
    const resourceType = formData.get('resourceType') as string | null; // <-- NEW FIELD (or use mimeType if preferred)

    console.log(`${REQ_DEBUG_PREFIX} Extracted form data: title='${title}', description='${description}', category='${category}', subject='${subject}', unit='${unit}', resourceType='${resourceType}', file presence=${!!file}`);

    // --- Input Validation (include NEW fields) ---
    if (!file) {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: Missing file.`);
      return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    }
    // Add checks for new mandatory fields here if needed
    if (!title || !description || !category || !subject || !unit || !resourceType ) {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: Missing required form fields.`, { title: !!title, description: !!description, category: !!category, subject: !!subject, unit: !!unit, resourceType: !!resourceType });
      return NextResponse.json({ error: 'Missing required form fields (title, description, category, subject, unit, resourceType).' }, { status: 400 });
    }
     const originalFilename = file.name;
     const mimeType = file.type; // Keep mimeType in case you want it later
     console.log(`${REQ_DEBUG_PREFIX} File details - Name: ${originalFilename}, Size: ${file.size}, Type: ${mimeType}`);
     console.log(`${REQ_DEBUG_PREFIX} Input validation passed.`);

    // --- File Processing & Stream Creation ---
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);
    console.log(`${REQ_DEBUG_PREFIX} File buffer processed. Buffer length: ${fileBuffer.length}`);
    const fileReadableStream = Readable.from(fileBuffer);
    console.log(`${REQ_DEBUG_PREFIX} Creating readable stream from buffer...`);


    // --- Google Drive Upload ---
    if (!GOOGLE_DRIVE_FOLDER_ID) {
      console.error(`${REQ_DEBUG_PREFIX} API Config Error: GOOGLE_DRIVE_FOLDER_ID not set.`);
      throw new Error('Server configuration error: Drive folder ID missing.');
    }
    const driveFileMetadata = {
        name: originalFilename, // Use original file name for Drive
        parents: [GOOGLE_DRIVE_FOLDER_ID],
        description: description, // Use description from form for Drive file
    };
    const driveMedia = {
        mimeType: mimeType,
        body: fileReadableStream,
    };
    console.log(`${REQ_DEBUG_PREFIX} Calling drive.files.create with metadata:`, JSON.stringify(driveFileMetadata), `and media type: ${driveMedia.mimeType}`);
    const driveUploadResponse = await drive.files.create({
      requestBody: driveFileMetadata,
      media: driveMedia,
      fields: 'id, webViewLink' // Reduced fields slightly
    });
    console.log(`${REQ_DEBUG_PREFIX} Google Drive upload API call successful.`);
    const driveFileId = driveUploadResponse.data.id;
    const driveFileWebViewLink = driveUploadResponse.data.webViewLink;
    const driveFileLink = driveFileWebViewLink || `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`; // Fallback link

    if (!driveFileId) {
        console.error(`${REQ_DEBUG_PREFIX} Drive upload seemed successful, but no file ID received in response!`);
        throw new Error('Failed to get file ID from Google Drive after upload.');
    }
    console.log(`${REQ_DEBUG_PREFIX} File uploaded to Google Drive - ID: ${driveFileId}, Link: ${driveFileLink}`);

    // --- Google Drive Permissions ---
    console.log(`${REQ_DEBUG_PREFIX} Setting public permissions for Drive file ${driveFileId}...`);
    try {
      await drive.permissions.create({
        fileId: driveFileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
      console.log(`${REQ_DEBUG_PREFIX} Google Drive file permissions set to public successfully.`);
    } catch (permError: any) {
      console.warn(`${REQ_DEBUG_PREFIX} WARN: Failed to set public permissions for file ${driveFileId}. Check Service Account permissions.`, permError.message);
      // Log details but continue
       if (permError.response?.data?.error) { console.warn(`${REQ_DEBUG_PREFIX} Google Permission API Error Details:`, JSON.stringify(permError.response.data.error, null, 2)); }
       else if (permError.errors) { console.warn(`${REQ_DEBUG_PREFIX} Google Permission API Error Array:`, JSON.stringify(permError.errors, null, 2)); }
       else { console.warn(`${REQ_DEBUG_PREFIX} Full Permission Error Object:`, permError); }
    }

    // --- Google Sheets Update (NEW COLUMN ORDER) ---
    if (!GOOGLE_SHEET_ID) {
      console.warn(`${REQ_DEBUG_PREFIX} WARN: GOOGLE_SHEET_ID not set. Skipping Google Sheets update.`);
    } else {
      console.log(`${REQ_DEBUG_PREFIX} Preparing Google Sheets update for Sheet ID: ${GOOGLE_SHEET_ID}`);
      try {
        const sheetRange = 'pecup!A1'; // Target sheet and starting cell for append
        const resourceDate = new Date().toISOString(); // Generate timestamp

        // --- Construct the row data in the NEW required order ---
        const valuesToAppend = [[
            category,       // 1. Category
            subject,        // 2. Subject (New from form)
            unit,           // 3. Unit (New from form)
            title,          // 4. Resource Name
            description,    // 5. Resource Description
            resourceDate,   // 6. Resource Date
            resourceType,   // 7. Resource Type (New from form)
                            //    Alternatively, use: mimeType if you want the file's actual mime type
            driveFileLink   // 8. Resource URL
        ]];
        // ---------------------------------------------------------

        console.log(`${REQ_DEBUG_PREFIX} Calling sheets.spreadsheets.values.append`);
        console.log(`${REQ_DEBUG_PREFIX} Values to append:`, JSON.stringify(valuesToAppend));

        const appendResponse = await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: sheetRange,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: valuesToAppend,
          },
        });
        console.log(`${REQ_DEBUG_PREFIX} Data appended to Google Sheet successfully. Status: ${appendResponse.status}`);

      } catch (sheetError: any) {
        console.error(`${REQ_DEBUG_PREFIX} ERROR: Failed to append to Google Sheet ${GOOGLE_SHEET_ID}.`);
        console.error(`${REQ_DEBUG_PREFIX} Sheet Error Message:`, sheetError.message || 'No message');
         if (sheetError.response?.data?.error) { console.error(`${REQ_DEBUG_PREFIX} Google Sheet API Error Details:`, JSON.stringify(sheetError.response.data.error, null, 2)); }
         else if (sheetError.errors) { console.error(`${REQ_DEBUG_PREFIX} Google Sheet API Error Array:`, JSON.stringify(sheetError.errors, null, 2)); }
         else { console.error(`${REQ_DEBUG_PREFIX} Full Sheet Error Object:`, sheetError); }
        throw new Error(`Failed to update spreadsheet: ${sheetError.message}`); // Fail the request if sheet update fails
      }
    }

    // --- Success Response ---
    console.log(`${REQ_DEBUG_PREFIX} Process completed successfully for file: ${originalFilename}. Sending success response.`);
    return NextResponse.json(
      {
        message: 'Resource uploaded successfully!',
        fileName: originalFilename,
        driveLink: driveFileLink,
      },
      { status: 200 }
    );

  } catch (error: any) {
    // --- General Error Handling ---
    console.error(`${REQ_DEBUG_PREFIX} FATAL ERROR during upload process:`, error.message || 'Unknown error');
    console.error(`${REQ_DEBUG_PREFIX} Full error object during upload:`, error);

    // Log specific Google API error structures if present
    if (error?.response?.data?.error) { console.error(`${REQ_DEBUG_PREFIX} Google API Error Details found:`, JSON.stringify(error.response.data.error, null, 2)); }
    else if (error.errors) { console.error(`${REQ_DEBUG_PREFIX} Google API Error Array found:`, JSON.stringify(error.errors, null, 2)); }

    return NextResponse.json(
      { error: 'Failed to upload resource.', details: error.message || 'An unknown server error occurred.' },
      { status: 500 }
    );
  }
}

// --- API Configuration ---
export const config = {
  api: {
    bodyParser: false, // Keep disabled for FormData
  },
};