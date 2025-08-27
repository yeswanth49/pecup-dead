// app/api/secure-file/[token]/route.ts
// Secure file access endpoint for Google Drive files during migration

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { google } from 'googleapis';
import { createSupabaseAdmin } from '@/lib/supabase';
import { UserContext } from '@/lib/auth-permissions';

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  const DEBUG_PREFIX = '[API DEBUG SecureFile]';
  console.log(`${DEBUG_PREFIX} Received secure file request`);

  try {
    // 1. Validate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.warn(`${DEBUG_PREFIX} No valid session`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Decode and validate token
    const tokenData = validateSecureToken(params.token);
    if (!tokenData) {
      console.warn(`${DEBUG_PREFIX} Invalid or expired token`);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
    }

    // 3. Get user context and check permissions
    const supabase = createSupabaseAdmin();

    // Get user role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('email', session.user.email.toLowerCase())
      .maybeSingle();

    if (profileError || !profile) {
      console.warn(`${DEBUG_PREFIX} User profile not found`);
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    // Get user context (this will include representative assignments if applicable)
    let userContext: UserContext;
    try {
      // Import the function to get user context
      const { getCurrentUserContext } = await import('@/lib/auth-permissions');
      const context = await getCurrentUserContext();
      if (!context) {
        console.warn(`${DEBUG_PREFIX} Could not get user context`);
        return NextResponse.json({ error: 'Could not verify permissions' }, { status: 403 });
      }
      userContext = context;
    } catch (contextError) {
      console.error(`${DEBUG_PREFIX} Error getting user context:`, contextError);
      return NextResponse.json({ error: 'Permission verification failed' }, { status: 500 });
    }

    // 4. Check if user has access to this file (through resource permissions)
    const hasAccess = await checkFileAccess(tokenData.fileId, userContext);
    if (!hasAccess) {
      console.warn(`${DEBUG_PREFIX} Access denied for user ${userContext.email} to file ${tokenData.fileId}`);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 5. Serve the file from Google Drive
    const fileBuffer = await downloadFromGoogleDrive(tokenData.fileId);
    if (!fileBuffer) {
      console.error(`${DEBUG_PREFIX} Failed to download file from Google Drive`);
      return NextResponse.json({ error: 'File not available' }, { status: 404 });
    }

    // 6. Return file with appropriate headers
    console.log(`${DEBUG_PREFIX} Successfully serving secure file to ${userContext.email}`);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="document.pdf"',
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error: any) {
    console.error(`${DEBUG_PREFIX} Error serving secure file:`, error.message || error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate the secure access token
 */
function validateSecureToken(token: string): { fileId: string; expiresAt: Date } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const tokenData = JSON.parse(decoded);

    if (!tokenData.fileId || !tokenData.expiresAt) {
      return null;
    }

    const expiresAt = new Date(tokenData.expiresAt);
    if (expiresAt < new Date()) {
      return null; // Token expired
    }

    return {
      fileId: tokenData.fileId,
      expiresAt
    };
  } catch (error) {
    console.warn('Token validation failed:', error);
    return null;
  }
}

/**
 * Check if user has access to the specific file
 */
async function checkFileAccess(fileId: string, userContext: UserContext): Promise<boolean> {
  const supabase = createSupabaseAdmin();

  try {
    // Find the resource that corresponds to this file
    const { data: resource, error } = await supabase
      .from('resources')
      .select('branch_id, year_id, semester_id')
      .eq('drive_link', `https://drive.google.com/file/d/${fileId}/view`)
      .single();

    if (error || !resource) {
      console.warn('Resource not found for file ID:', fileId);
      return false;
    }

    // Check permissions based on user role
    if (userContext.role === 'admin' || userContext.role === 'superadmin') {
      return true;
    }

    if (userContext.role === 'student') {
      return (
        userContext.branchId === resource.branch_id &&
        userContext.yearId === resource.year_id &&
        userContext.semesterId === resource.semester_id
      );
    }

    if (userContext.role === 'representative') {
      return userContext.representativeAssignments?.some(assignment =>
        assignment.branch_id === resource.branch_id &&
        assignment.year_id === resource.year_id
      ) || false;
    }

    return false;
  } catch (error) {
    console.error('Error checking file access:', error);
    return false;
  }
}

/**
 * Download file from Google Drive using service account
 */
async function downloadFromGoogleDrive(fileId: string): Promise<Buffer | null> {
  try {
    // Get Google Drive credentials
    let credentials;
    try {
      const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64;
      const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      let raw = rawJson || '{}';
      if (rawB64) {
        raw = Buffer.from(rawB64, 'base64').toString('utf8');
      }
      credentials = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse Google credentials for secure file access:', e);
      return null;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Download the file
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error('Error downloading from Google Drive:', error);
    return null;
  }
}
