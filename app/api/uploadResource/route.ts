// app/api/uploadResource/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { createSupabaseAdmin } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateFile, getFileExtension } from '@/lib/file-validation';
import { getSettings } from '@/lib/admin-auth'; // Import getSettings
import { ResourceCreateInput } from '@/lib/types'; // Import ResourceCreateInput

// Define ResourceInsert based on ResourceCreateInput and actual DB schema
interface ResourceInsert extends ResourceCreateInput {
  file_name: string;
  file_mime_type: string;
  uploaded_by: string;
  storage_location: string;
  resource_type: string;
  unit: number;
  category: string;
  subject: string;
}

// Debug logging prefix
const DEBUG_PREFIX = '[API DEBUG UploadResource]';

// Environment Variables
const authorizedEmails = (process.env.AUTHORIZED_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

// Upload constraints
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB hard limit to avoid memory blowups

// Lazy initializer for Supabase admin client (no module-scope side effects)
let cachedSupabaseAdmin: SupabaseClient | null = null;
async function getSupabaseAdmin(): Promise<SupabaseClient> {
  if (cachedSupabaseAdmin) return cachedSupabaseAdmin;
  try {
    const client = createSupabaseAdmin();
    if (!client || typeof (client as any).from !== 'function') {
      throw new Error('Supabase admin client failed validation.');
    }
    cachedSupabaseAdmin = client;
    return client;
  } catch (err: any) {
    console.error(`${DEBUG_PREFIX} Failed to initialize Supabase admin client:`, err?.message || err);
    throw new Error('Server configuration error: Supabase admin initialization failed.');
  }
}

async function getGoogleAuthClient() {
  const FN_DEBUG_PREFIX = `${DEBUG_PREFIX} [getGoogleAuthClient]`;
  try {
    console.log(`${FN_DEBUG_PREFIX} Attempting to get Google Auth Client...`);
    const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
    const credentialsJSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    let raw = credentialsJSON || '{}'
    if (rawB64) {
      try {
        raw = Buffer.from(rawB64, 'base64').toString('utf8')
        console.log(`${FN_DEBUG_PREFIX} Decoded GOOGLE_APPLICATION_CREDENTIALS_B64 successfully.`)
      } catch (e) {
        console.error(`${FN_DEBUG_PREFIX} Failed to decode GOOGLE_APPLICATION_CREDENTIALS_B64:`, e)
        throw new Error('Server configuration error: Invalid base64 Google credentials.');
      }
    }

    if (!raw || typeof raw !== 'string' || raw.trim() === '') {
      console.error(`${FN_DEBUG_PREFIX} API Setup Error: Google credentials not set or empty.`);
      throw new Error('Server configuration error: Google credentials missing or invalid.');
    }

    let credentials;
    try {
      credentials = JSON.parse(raw);
      console.log(`${FN_DEBUG_PREFIX} Successfully parsed Google credentials.`);
    } catch (parseError: any) {
      console.error(`${FN_DEBUG_PREFIX} API Setup Error: Failed to parse Google credentials JSON.`, parseError.message);
      throw new Error('Server configuration error: Invalid Google credentials format.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    console.log(`${FN_DEBUG_PREFIX} Google Auth Client obtained successfully.`);
    return auth;

  } catch (error: any) {
    console.error(`${FN_DEBUG_PREFIX} Error during Google Auth Client initialization:`, error.message);
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

  if (!session.user?.email) {
    console.log(`${FN_DEBUG_PREFIX} Session exists but user email is missing.`);
    return null;
  }

  const userEmail = session.user.email;
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
    return NextResponse.json({ error: 'Internal server error during authorization.' }, { status: 500 });
  }

  // Main Upload Logic
  try {
    const formData = await request.formData();
    console.log(`${REQ_DEBUG_PREFIX} FormData keys found:`, Array.from(formData.keys()));

    // Extract form fields
    const file: File | null = formData.get('theFile') as File | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const category = formData.get('category') as string | null;
    const subject = formData.get('subject') as string | null;
    const unitRaw = formData.get('unit') as string | null;
    const resourceType = formData.get('resourceType') as string | null;

    console.log(`${REQ_DEBUG_PREFIX} Extracted form data: title='${title}', description='${description}', category='${category}', subject='${subject}', unitRaw='${unitRaw}', resourceType='${resourceType}', file presence=${!!file}`);

    // Input Validation
    if (!file) {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: Missing file.`);
      return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    }
    if (!title || !description || !category || !subject || !resourceType) {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: Missing required form fields.`);
      return NextResponse.json({ error: 'Missing required form fields (title, description, category, subject, resourceType).' }, { status: 400 });
    }

    // Validate unit specifically
    if (unitRaw === null) {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: Unit is required.`);
      return NextResponse.json({ error: 'Unit is required.' }, { status: 400 });
    }
    const unitStr = String(unitRaw).trim();
    if (unitStr === '') {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: Unit cannot be empty.`);
      return NextResponse.json({ error: 'Unit cannot be empty.' }, { status: 400 });
    }
    const parsedUnit = Number.parseInt(unitStr, 10);
    if (!Number.isInteger(parsedUnit) || !Number.isFinite(parsedUnit) || parsedUnit < 1 || parsedUnit > 12) {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: Invalid unit value: ${unitRaw}.`);
      return NextResponse.json({ error: 'Unit must be an integer between 1 and 12.' }, { status: 400 });
    }

    // File Processing
    const buffer = Buffer.from(await file.arrayBuffer());
    const originalFilename = file.name;
    const fileExtension = originalFilename.split('.').pop()?.toLowerCase() || '';
    const clientMimeType = file.type;
    console.log(`${REQ_DEBUG_PREFIX} File details: filename='${originalFilename}', extension='${fileExtension}', clientMimeType='${clientMimeType}', size=${file.size} bytes.`);

    // Validate file type and size
    if (file.size > MAX_UPLOAD_BYTES) {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: File size (${file.size} bytes) exceeds limit (${MAX_UPLOAD_BYTES} bytes).`);
      return NextResponse.json({ error: 'File size exceeds limit.' }, { status: 413 });
    }

    const validationResult = validateFile(buffer, originalFilename, clientMimeType);
    if (!validationResult.ok) {
      console.error(`${REQ_DEBUG_PREFIX} File Validation Failed:`, validationResult.reason);
      return NextResponse.json({ error: validationResult.reason }, { status: 415 });
    }
    console.log(`${REQ_DEBUG_PREFIX} File validation successful. Detected MIME type: ${validationResult.detectedMime}.`);

    const effectiveMimeType = validationResult.detectedMime || clientMimeType || 'application/octet-stream';
    const isPdf = effectiveMimeType === 'application/pdf' || fileExtension === 'pdf';
    const settings = await getSettings(); // Reinstated getSettings
    console.log(`${REQ_DEBUG_PREFIX} Determined file as PDF: ${isPdf}. PDF to Drive setting: ${settings?.pdf_to_drive}.`);

    let finalUrl: string;
    let storageLocation: string;

    // Initialize Supabase admin at runtime (after auth) and handle failures
    let supabaseAdmin: SupabaseClient;
    try {
      supabaseAdmin = await getSupabaseAdmin();
    } catch (initErr: any) {
      console.error(`${REQ_DEBUG_PREFIX} Supabase admin initialization error:`, initErr?.message || initErr);
      return NextResponse.json({ error: 'Server configuration error. Please try again later.' }, { status: 500 });
    }

    if (isPdf && settings?.pdf_to_drive) {
      // Upload PDFs to Google Drive
      console.log(`${REQ_DEBUG_PREFIX} Uploading PDF to Google Drive.`);
      
      const authClient = await getGoogleAuthClient();
      const drive = google.drive({ version: 'v3', auth: authClient });

      if (!GOOGLE_DRIVE_FOLDER_ID) {
        console.error(`${REQ_DEBUG_PREFIX} API Config Error: GOOGLE_DRIVE_FOLDER_ID not set.`);
        throw new Error('Server configuration error: Drive folder ID missing.');
      }

      const fileReadableStream = Readable.from(buffer);

      const driveFileMetadata = {
        name: originalFilename,
        parents: [GOOGLE_DRIVE_FOLDER_ID],
        description: description,
      };

      const driveMedia = {
        mimeType: effectiveMimeType || 'application/pdf',
        body: fileReadableStream,
      };

      const driveUploadResponse = await drive.files.create({
        requestBody: driveFileMetadata,
        media: driveMedia,
        fields: 'id, webViewLink'
      });

      const driveFileId = driveUploadResponse.data.id;
      const driveFileWebViewLink = driveUploadResponse.data.webViewLink;
      finalUrl = driveFileWebViewLink || `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;

      if (!driveFileId) {
        throw new Error('Failed to get file ID from Google Drive after upload.');
      }

      // Set public permissions
      try {
        await drive.permissions.create({
          fileId: driveFileId,
          requestBody: { role: 'reader', type: 'anyone' },
        });
        console.log(`${REQ_DEBUG_PREFIX} Google Drive file permissions set to public successfully.`);
      } catch (permError: any) {
        console.error(`${REQ_DEBUG_PREFIX} ERROR: Failed to set public permissions for file ${driveFileId}.`, permError?.message || permError);
        // Attempt rollback: delete uploaded file so we do not leave inaccessible artifacts
        try {
          await drive.files.delete({ fileId: driveFileId });
          console.error(`${REQ_DEBUG_PREFIX} Rolled back Google Drive upload due to permissions failure. Deleted file ${driveFileId}.`);
        } catch (rollbackError: any) {
          console.error(`${REQ_DEBUG_PREFIX} CRITICAL: Failed to delete uploaded file ${driveFileId} after permissions failure.`, rollbackError?.message || rollbackError);
        }
        // Treat as critical to avoid returning a link that won't be publicly accessible
        throw new Error('Failed to set public permissions on uploaded file. Upload has been rolled back.');
      }

      console.log(`${REQ_DEBUG_PREFIX} PDF uploaded to Google Drive - ID: ${driveFileId}, Link: ${finalUrl}`);
      storageLocation = 'Google Drive';
    } else {
      // Upload non-PDFs to Supabase Storage
      console.log(`${REQ_DEBUG_PREFIX} Uploading to Supabase Storage.`);
      
      const fileName = `${Date.now()}-${originalFilename}`;
      
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('resources')
        .upload(fileName, buffer, {
          contentType: effectiveMimeType || undefined,
          duplex: 'half'
        });

      if (uploadError) {
        console.error(`${REQ_DEBUG_PREFIX} Supabase Storage upload error:`, uploadError);
        throw new Error(`Failed to upload file to Supabase Storage: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('resources')
        .getPublicUrl(fileName);

      finalUrl = urlData.publicUrl;
      console.log(`${REQ_DEBUG_PREFIX} Non-PDF uploaded to Supabase Storage - Path: ${uploadData.path}, URL: ${finalUrl}`);
      storageLocation = 'Supabase Storage';
    }

    // Database Insertion
    console.log(`${REQ_DEBUG_PREFIX} Preparing database insertion payload.`);
    const insertPayload: ResourceInsert = {
      title: title as string,
      description: description || undefined,
      category: category as string,
      subject: subject as string,
      unit: parsedUnit,
      resource_type: resourceType as string,
      file_url: finalUrl,
      drive_link: finalUrl.includes('drive.google.com') ? finalUrl : '',
      file_path: finalUrl, // Storing URL in file_path for consistency or future use
      file_name: originalFilename,
      file_mime_type: effectiveMimeType,
      uploaded_by: authorizedUser.id,
      storage_location: storageLocation,
      // Assuming these are not directly from ResourceCreateInput or need mapping
      branch_id: 'default', // Placeholder, adjust as per your logic
      year_id: 'default', // Placeholder, adjust as per your logic
      semester_id: 'default', // Placeholder, adjust as per your logic
    };

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('resources')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      console.error(`${REQ_DEBUG_PREFIX} Database Insertion Error:`, insertError.message);
      return NextResponse.json({ error: 'Failed to save resource to database.', details: insertError.message }, { status: 500 });
    }
    if (!insertData) {
      console.error(`${REQ_DEBUG_PREFIX} Database Insertion Error: No data returned after insert.`);
      return NextResponse.json({ error: 'Failed to retrieve resource ID after insert.' }, { status: 500 });
    }
    console.log(`${REQ_DEBUG_PREFIX} Database insertion successful. New resource ID: ${insertData.id}.`);

    // Success Response
    console.log(`${REQ_DEBUG_PREFIX} Process completed successfully for file: ${originalFilename}. Sending success response.`);
    return NextResponse.json(
      {
        message: 'Resource uploaded successfully!',
        fileName: originalFilename,
        url: finalUrl,
        resourceId: insertData.id,
        storageLocation: storageLocation
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error(`${REQ_DEBUG_PREFIX} FATAL ERROR during upload process:`, error.message || 'Unknown error');
    console.error(`${REQ_DEBUG_PREFIX} Full error object during upload:`, error);

    return NextResponse.json(
      { error: 'Failed to upload resource.', details: error.message || 'An unknown server error occurred.' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};