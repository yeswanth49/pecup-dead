import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserContext, requirePermission, canManageResources } from '@/lib/auth-permissions'
import { createSupabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { validateFile } from '@/lib/file-validation'
import { google } from 'googleapis'
import { Readable } from 'stream'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

function toInt(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * GET /api/representative/resources
 * Get resources that the representative can manage
 */
export async function GET(request: NextRequest) {
  try {
    const userContext = await getCurrentUserContext()
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (userContext.role !== 'representative') {
      return NextResponse.json({ error: 'Forbidden: Representatives only' }, { status: 403 })
    }

    const supabase = createSupabaseAdmin()
    const url = new URL(request.url)
    
    // Get query parameters
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Get representative's assigned branches and years
    const assignedBranchIds = userContext.representatives?.map(rep => rep.branch_id) || []
    const assignedYearIds = userContext.representatives?.map(rep => rep.year_id) || []

    if (assignedBranchIds.length === 0) {
      return NextResponse.json({ resources: [], total: 0 })
    }

    let query = supabase
      .from('resources')
      .select(`
        id, name, title, description, category, subject, unit, type, date, is_pdf, url, 
        year, branch, archived, semester, file_type, drive_link,
        branch_id, year_id, semester_id, uploader_id, created_at, updated_at,
        branches:branch_id(id, name, code),
        years:year_id(id, batch_year, display_name),
        semesters:semester_id(id, semester_number)
      `, { count: 'exact' })
      .in('branch_id', assignedBranchIds)
      .in('year_id', assignedYearIds)
      .order('created_at', { ascending: false })

    // Apply additional filters
    const branchFilter = url.searchParams.get('branchId')
    if (branchFilter && assignedBranchIds.includes(branchFilter)) {
      query = query.eq('branch_id', branchFilter)
    }

    const yearFilter = url.searchParams.get('yearId')
    if (yearFilter && assignedYearIds.includes(yearFilter)) {
      query = query.eq('year_id', yearFilter)
    }

    const semesterFilter = url.searchParams.get('semesterId')
    if (semesterFilter) {
      query = query.eq('semester_id', semesterFilter)
    }

    const archivedParam = url.searchParams.get('archived')
    if (archivedParam === 'true') query = query.eq('archived', true)
    if (archivedParam === 'false') query = query.eq('archived', false)

    const { data: resources, error, count } = await query.range(from, to)

    if (error) {
      console.error('Representative resources GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 })
    }

    return NextResponse.json({
      resources,
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 1
    })
  } catch (error) {
    console.error('Representative resources error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/representative/resources
 * Create a new resource (representatives only for their assigned branch/year)
 */
export async function POST(request: NextRequest) {
  const REQ_DEBUG_PREFIX = '[API DEBUG RepresentativeResources POST]';
  console.log(`${REQ_DEBUG_PREFIX} Received POST request at ${new Date().toISOString()}`);
  try {
    const userContext = await requirePermission('write', 'resources');
    console.log(`${REQ_DEBUG_PREFIX} User authorized: ${userContext.email}, Role: ${userContext.role}`);
    
    if (userContext.role !== 'representative') {
      console.error(`${REQ_DEBUG_PREFIX} Forbidden: User is not a representative.`);
      return NextResponse.json({ error: 'Forbidden: Representatives only' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const contentType = request.headers.get('content-type') || '';

    let payload: any = {};
    let file: File | null = null;

    console.log(`${REQ_DEBUG_PREFIX} Content-Type: ${contentType}`);

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      for (const k of form.keys()) payload[k] = form.get(k);
      file = (form.get('file') as unknown as File) || null;
      console.log(`${REQ_DEBUG_PREFIX} Parsed FormData: file presence=${!!file}, payload keys: ${Object.keys(payload).join(', ')}`);
    } else {
      payload = await request.json();
      console.log(`${REQ_DEBUG_PREFIX} Parsed JSON payload: keys: ${Object.keys(payload).join(', ')}`);
    }

    // Normalize ID fields to accept either snake_case or camelCase from clients
    const branchId = payload.branch_id || payload.branchId || payload.branch || null
    const yearId = payload.year_id || payload.yearId || payload.year || null
    const semesterId = payload.semester_id || payload.semesterId || payload.semester || null
    const title = payload.title || payload.name || null
    console.log(`${REQ_DEBUG_PREFIX} Extracted IDs: branchId=${branchId}, yearId=${yearId}, semesterId=${semesterId}, title=${title}.`);

    // Validate required fields
    if (!title) {
      console.error(`${REQ_DEBUG_PREFIX} Missing required field: title.`)
      return NextResponse.json({ error: 'Missing field title' }, { status: 400 })
    }
    if (!branchId || !yearId || !semesterId) {
      console.error(`${REQ_DEBUG_PREFIX} Missing branch/year/semester IDs. Received: branchId=${branchId}, yearId=${yearId}, semesterId=${semesterId}`)
      return NextResponse.json({ error: 'Missing field branch/year/semester IDs' }, { status: 400 })
    }

    // Verify representative can manage this branch/year
    const canManage = await canManageResources(branchId, yearId);
    if (!canManage) {
      console.error(`${REQ_DEBUG_PREFIX} Forbidden: Representative cannot manage resources for branchId: ${branchId}, yearId: ${yearId}.`);
      return NextResponse.json(
        { error: 'Forbidden: Cannot manage resources for this branch/year' },
        { status: 403 }
      );
    }
    console.log(`${REQ_DEBUG_PREFIX} Representative authorized to manage resources for branchId: ${branchId}, yearId: ${yearId}.`);

    let url: string | undefined;
    let fileType: string | undefined;

    if (file) {
      console.log(`${REQ_DEBUG_PREFIX} File detected for upload.`);
      const originalName = (file as any).name as string;
      const clientMime = (file as any).type as string | undefined;
      const size = (file as any).size as number | undefined;
      console.log(`${REQ_DEBUG_PREFIX} File details: name='${originalName}', clientMime='${clientMime}', size=${size} bytes.`);
      
      if (typeof size === 'number' && size > MAX_UPLOAD_BYTES) {
        console.error(`${REQ_DEBUG_PREFIX} File too large: ${size} bytes > ${MAX_UPLOAD_BYTES} bytes.`);
        return NextResponse.json({ error: 'File too large' }, { status: 413 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = validateFile(buffer, originalName, clientMime);
      if (!validation.ok) {
        console.error(`${REQ_DEBUG_PREFIX} File validation failed:`, validation.reason);
        return NextResponse.json({ error: 'Unsupported file type', reason: validation.reason }, { status: 415 });
      }
      console.log(`${REQ_DEBUG_PREFIX} File validation successful. Detected MIME: ${validation.detectedMime}.`);

      const effectiveMime = (validation.detectedMime || clientMime || '').toLowerCase();
      const isPdf = effectiveMime === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
      fileType = effectiveMime;
      console.log(`${REQ_DEBUG_PREFIX} Effective MIME: ${effectiveMime}, Is PDF: ${isPdf}.`);

      // Upload to appropriate storage
      if (isPdf) {
        console.log(`${REQ_DEBUG_PREFIX} Uploading PDF to Google Drive.`);
        const uploaded = await uploadToDrive(buffer, originalName, effectiveMime, payload.description);
        url = uploaded.url;
        console.log(`${REQ_DEBUG_PREFIX} Google Drive upload successful. URL: ${url}`);
      } else {
        console.log(`${REQ_DEBUG_PREFIX} Uploading to Supabase Storage.`);
        const uploaded = await uploadToStorage(buffer, originalName, effectiveMime);
        url = uploaded.url;
        console.log(`${REQ_DEBUG_PREFIX} Supabase Storage upload successful. URL: ${url}`);
      }
    } else if (payload.url) {
      url = String(payload.url);
      fileType = url.toLowerCase().includes('drive.google.com') ? 'application/pdf' : 'unknown';
      console.log(`${REQ_DEBUG_PREFIX} URL provided: ${url}, File Type: ${fileType}.`);
    } else {
      console.error(`${REQ_DEBUG_PREFIX} Neither file nor URL provided.`);
      return NextResponse.json({ error: 'Either file or url is required' }, { status: 400 });
    }

    const insertPayload = {
      title: String(payload.title),
      description: payload.description ? String(payload.description) : null,
      branch_id: branchId,
      year_id: yearId,
      semester_id: semesterId,
      file_type: fileType,
      drive_link: url,
      url: url, // Keep for backward compatibility
      uploader_id: userContext.id,
      // Legacy fields for backward compatibility
      name: String(payload.title),
      category: payload.category || 'resource',
      subject: payload.subject || 'general',
      unit: payload.unit ? toInt(payload.unit) : 1,
      is_pdf: fileType?.includes('pdf') || false
    };
    console.log(`${REQ_DEBUG_PREFIX} Insert payload prepared:`, insertPayload);

    const { data, error } = await supabase
      .from('resources')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      console.error(`${REQ_DEBUG_PREFIX} Error creating resource in database:`, error);
      return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
    }
    console.log(`${REQ_DEBUG_PREFIX} Resource created successfully with ID: ${data.id}.`);

    // Log the action
    await logAudit({
      actorEmail: userContext.email,
      actorRole: 'admin', // Representatives log as admin for audit purposes
      action: 'create',
      entity: 'resource',
      entityId: data.id,
      success: true,
      message: `Representative created resource: ${payload.title}`,
      afterData: insertPayload
    });
    console.log(`${REQ_DEBUG_PREFIX} Audit log created.`);

    return NextResponse.json({ id: data.id, ...insertPayload });
  } catch (error: any) {
    console.error(`${REQ_DEBUG_PREFIX} Representative resource creation error:`, error);
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions for file upload (duplicated from admin route for now)
async function uploadToDrive(fileBuffer: Buffer, fileName: string, mime: string, description?: string) {
  // Get settings
  const supabase = createSupabaseAdmin()
  const { data: settings } = await supabase.from('settings').select('*').single()
  const driveFolderId = settings?.drive_folder_id || process.env.GOOGLE_DRIVE_FOLDER_ID
  
  if (!driveFolderId) throw new Error('Drive folder id not configured')
  
  let credentials;
  try {
    const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    let raw = rawJson || '{}'
    if (rawB64) {
      try {
        raw = Buffer.from(rawB64, 'base64').toString('utf8')
      } catch (e) {
        console.error('Failed to decode GOOGLE_APPLICATION_CREDENTIALS_B64:', e)
        throw e
      }
    }
    credentials = JSON.parse(raw)
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid Google credentials: missing required fields')
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to parse Google credentials'
    console.error('Google credentials validation error:', errorMessage)
    throw new Error('Google Drive configuration error')
  }
  
  const auth = new google.auth.GoogleAuth({ 
    credentials, 
    scopes: ['https://www.googleapis.com/auth/drive'] 
  })
  const drive = google.drive({ version: 'v3', auth })
  const fileReadable = Readable.from(fileBuffer)
  
  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [driveFolderId], description },
    media: { mimeType: mime || 'application/pdf', body: fileReadable },
    fields: 'id,webViewLink',
  })
  
  if (!data.id) throw new Error('Drive upload failed')
  
  await drive.permissions.create({ 
    fileId: data.id, 
    requestBody: { role: 'reader', type: 'anyone' } 
  })
  
  const url = data.webViewLink || `https://drive.google.com/file/d/${data.id}/view?usp=sharing`
  return { url }
}

async function uploadToStorage(fileBuffer: Buffer, fileName: string, mime?: string) {
  const supabase = createSupabaseAdmin()
  const { data: settings } = await supabase.from('settings').select('*').single()
  const bucket = settings?.storage_bucket || 'resources'
  
  const uploadPath = `${Date.now()}-${fileName}`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(uploadPath, fileBuffer, { 
      contentType: mime || undefined, 
      duplex: 'half' as any 
    })
  
  if (error) throw error
  
  const { data } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
  return { url: data.publicUrl }
}
