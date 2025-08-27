// app/api/secure-file/[token]/route.ts
// Secure file access endpoint for Google Drive files during migration

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { google } from 'googleapis';
import { createSupabaseAdmin } from '@/lib/supabase';
import { UserContext } from '@/lib/auth-permissions';
import jwt from 'jsonwebtoken';
import { checkRateLimit } from '@/lib/files';

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

    // 2.5. Rate limiting check
    const rateLimitKey = session.user.email?.toLowerCase() || 'anonymous';
    if (!checkRateLimit(rateLimitKey, 'secure-file-download', 20, 60000)) { // 20 downloads per minute
      console.warn(`${DEBUG_PREFIX} Rate limit exceeded for user ${rateLimitKey}`);
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
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
    // Log detailed error only in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      console.error(`${DEBUG_PREFIX} Error serving secure file:`, error.message || error);
    } else {
      // In production, log a generic error identifier only
      console.error(`${DEBUG_PREFIX} Error serving secure file: [REDACTED_ERROR_${Date.now()}]`);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate the secure access JWT token
 */
function validateSecureToken(token: string): { fileId: string; expiresAt: Date } | null {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as any;

    if (!decoded.fileId || !decoded.exp) {
      console.warn('Invalid JWT payload: missing fileId or exp');
      return null;
    }

    const expiresAt = new Date(decoded.exp * 1000);
    if (expiresAt < new Date()) {
      console.warn('JWT token has expired');
      return null; // Token expired
    }

    return {
      fileId: decoded.fileId,
      expiresAt
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn('JWT verification failed:', error.message);
    } else if (error instanceof jwt.TokenExpiredError) {
      console.warn('JWT token has expired');
    } else {
      console.warn('Token validation failed:', error);
    }
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

      // Check if either env var is present
      if (!rawB64 && !rawJson) {
        console.error('Google credentials not found: Both GOOGLE_APPLICATION_CREDENTIALS_B64 and GOOGLE_APPLICATION_CREDENTIALS_JSON environment variables are missing');
        return null;
      }

      let raw: string;
      if (rawB64) {
        raw = Buffer.from(rawB64, 'base64').toString('utf8');
      } else {
        raw = rawJson!;
      }

      credentials = JSON.parse(raw);

      // Validate that the parsed object contains required fields
      if (!credentials.client_email || !credentials.private_key) {
        console.error('Invalid Google credentials: Missing required fields client_email or private_key');
        return null;
      }
    } catch (e) {
      console.error('Failed to parse Google credentials for secure file access. Raw value length:', process.env.GOOGLE_APPLICATION_CREDENTIALS_B64?.length || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0);
      console.error('Parse error:', e);
      return null;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Check file size before downloading
    const metadataResponse = await drive.files.get({
      fileId: fileId,
      fields: 'size'
    });

    const fileSize = parseInt(metadataResponse.data.size || '0');
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

    if (fileSize > MAX_FILE_SIZE) {
      console.error(`File too large: ${fileSize} bytes`);
      return null;
    }

    // Download the file
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    });

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error('Error downloading from Google Drive:', error);
    return null;
  }
}
