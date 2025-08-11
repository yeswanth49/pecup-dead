// app/api/uploadResource/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { createSupabaseAdmin } from '@/lib/supabase';
const supabaseAdmin = createSupabaseAdmin();
import { validateFile, getFileExtension } from '@/lib/file-validation';

// Debug logging prefix
const DEBUG_PREFIX = '[API DEBUG UploadResource]';

// Environment Variables
const authorizedEmails = (process.env.AUTHORIZED_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

async function getGoogleAuthClient() {
  const FN_DEBUG_PREFIX = `${DEBUG_PREFIX} [getGoogleAuthClient]`;
  try {
    console.log(`${FN_DEBUG_PREFIX} Attempting to get Google Auth Client...`);
    const credentialsJSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (!credentialsJSON || typeof credentialsJSON !== 'string' || credentialsJSON.trim() === '') {
      console.error(`${FN_DEBUG_PREFIX} API Setup Error: GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set or empty.`);
      throw new Error('Server configuration error: Google credentials missing or invalid.');
    }

    let credentials;
    try {
      credentials = JSON.parse(credentialsJSON);
      console.log(`${FN_DEBUG_PREFIX} Successfully parsed GOOGLE_CREDENTIALS_JSON.`);
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
    if (!Number.isInteger(parsedUnit) || !Number.isFinite(parsedUnit) || parsedUnit < 0) {
      console.error(`${REQ_DEBUG_PREFIX} Validation Error: Invalid unit value '${unitStr}'.`);
      return NextResponse.json({ error: 'Invalid unit. Must be a non-negative integer.' }, { status: 400 });
    }
    const validatedUnit: number = parsedUnit;

    const originalFilename = file.name;
    const clientProvidedMime = file.type;

    // Read buffer early so we can validate content before any processing/storage
    const fileBuffer: Buffer = Buffer.from(await file.arrayBuffer());

    // Centralized whitelist validation (MIME, extension, and magic bytes)
    const validation = validateFile(fileBuffer, originalFilename, clientProvidedMime);
    if (!validation.ok) {
      const ext = getFileExtension(originalFilename);
      console.warn(
        `${REQ_DEBUG_PREFIX} File rejected by whitelist. Name='${originalFilename}', Ext='${ext}', Client MIME='${clientProvidedMime}', Detected='${validation.detectedMime}', Reason='${validation.reason}'`
      );
      const status = 415; // Unsupported Media Type
      return NextResponse.json(
        { error: 'Unsupported file type.', reason: validation.reason },
        { status }
      );
    }

    const effectiveMime = (validation.detectedMime || clientProvidedMime || '').toLowerCase();
    const isPdf = effectiveMime === 'application/pdf' || originalFilename.toLowerCase().endsWith('.pdf');

    if (effectiveMime && clientProvidedMime && effectiveMime !== clientProvidedMime.toLowerCase()) {
      console.warn(
        `${REQ_DEBUG_PREFIX} MIME mismatch: client='${clientProvidedMime}' vs detected='${effectiveMime}' for '${originalFilename}'. Proceeding with detected.`
      );
    }

    console.log(`${REQ_DEBUG_PREFIX} File details - Name: ${originalFilename}, Size: ${file.size}, Client MIME: ${clientProvidedMime}, Effective MIME: ${effectiveMime}, Is PDF: ${isPdf}`);

    let finalUrl = '';

    if (isPdf) {
      // Upload PDFs to Google Drive
      console.log(`${REQ_DEBUG_PREFIX} Uploading PDF to Google Drive...`);
      
      const authClient = await getGoogleAuthClient();
      const drive = google.drive({ version: 'v3', auth: authClient });

      if (!GOOGLE_DRIVE_FOLDER_ID) {
        console.error(`${REQ_DEBUG_PREFIX} API Config Error: GOOGLE_DRIVE_FOLDER_ID not set.`);
        throw new Error('Server configuration error: Drive folder ID missing.');
      }

      const fileReadableStream = Readable.from(fileBuffer);

      const driveFileMetadata = {
        name: originalFilename,
        parents: [GOOGLE_DRIVE_FOLDER_ID],
        description: description,
      };

      const driveMedia = {
        mimeType: effectiveMime || 'application/pdf',
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
    } else {
      // Upload non-PDFs to Supabase Storage
      console.log(`${REQ_DEBUG_PREFIX} Uploading non-PDF file to Supabase Storage...`);
      
      const fileName = `${Date.now()}-${originalFilename}`;
      
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('resources')
        .upload(fileName, fileBuffer, {
          contentType: effectiveMime || undefined,
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
    }

    // Save metadata to Supabase database
    console.log(`${REQ_DEBUG_PREFIX} Saving metadata to Supabase database...`);
    
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('resources')
      .insert({
        category: category,
        subject: subject.toLowerCase(),
        unit: validatedUnit,
        name: title,
        description: description,
        date: new Date().toISOString(),
        type: resourceType,
        url: finalUrl,
        is_pdf: isPdf
      })
      .select()
      .single();

    if (insertError) {
      console.error(`${REQ_DEBUG_PREFIX} Supabase database insert error:`, insertError);
      throw new Error(`Failed to save resource metadata: ${insertError.message}`);
    }

    console.log(`${REQ_DEBUG_PREFIX} Resource metadata saved successfully with ID: ${insertData.id}`);

    // Success Response
    console.log(`${REQ_DEBUG_PREFIX} Process completed successfully for file: ${originalFilename}. Sending success response.`);
    return NextResponse.json(
      {
        message: 'Resource uploaded successfully!',
        fileName: originalFilename,
        url: finalUrl,
        resourceId: insertData.id,
        storageLocation: isPdf ? 'Google Drive' : 'Supabase Storage'
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