import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { promises as fs } from 'fs'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin, getSettings, getCurrentUserContext, canManageResources, requirePermission } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { validateFile, getFileExtension } from '@/lib/file-validation'
import { tryParseDriveIdFromUrl, tryParseStoragePathFromUrl } from '@/lib/files'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

type Branch = 'CSE'|'AIML'|'DS'|'AI'|'ECE'|'EEE'|'MEC'|'CE'

function toInt(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(request: Request) {
  // Check user permissions - allow admins and representatives
  let userContext
  try {
    userContext = await getCurrentUserContext()
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Only allow admins and representatives to access this admin endpoint
    if (!['admin', 'superadmin', 'representative'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (err) {
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  const supabase = createSupabaseAdmin()
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  // Allow larger caps in dev to fetch all resources
  const limitCap = process.env.NODE_ENV === 'development' ? 1000 : 200
  const limit = Math.min(limitCap, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
  const sort = (url.searchParams.get('sort') || 'date') as 'date' | 'name' | 'created_at'
  const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc'
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('resources')
    .select('id,name,category,subject,unit,type,date,is_pdf,url,year,branch,archived,semester', { count: 'exact' })
    .order(sort, { ascending: order === 'asc' })

  // Optional filters
  const subject = url.searchParams.get('subject')
  if (subject) query = query.ilike('subject', `%${subject}%`)
  const category = url.searchParams.get('category')
  if (category) query = query.eq('category', category)
  const unit = toInt(url.searchParams.get('unit'))
  if (unit !== null) query = query.eq('unit', unit)
  const year = toInt(url.searchParams.get('year'))
  if (year !== null) query = query.eq('year', year)
  const semester = toInt(url.searchParams.get('semester'))
  if (semester !== null) query = query.eq('semester', semester)
  const branch = url.searchParams.get('branch')
  if (branch) query = query.eq('branch', branch)
  const archivedParam = url.searchParams.get('archived')
  if (archivedParam === 'true') query = query.eq('archived', true)
  if (archivedParam === 'false') query = query.eq('archived', false)

  // Apply role-based filtering
  if (userContext) {
    if (userContext.role === 'representative') {
      // Representatives can only see resources for their assigned branches/years
      const assignedBranchIds = userContext.representatives?.map(rep => rep.branch_id) || []
      const assignedYearIds = userContext.representatives?.map(rep => rep.year_id) || []
      
      if (assignedBranchIds.length > 0) {
        query = query.in('branch_id', assignedBranchIds)
      }
      if (assignedYearIds.length > 0) {
        query = query.in('year_id', assignedYearIds)
      }
    }
    // Admins see everything, no additional filtering needed
  }

  const { data, error, count } = await query.range(from, to)
  if (error) {
    console.error('Admin resources list error:', error)
    // Return an empty list instead of failing the UI in development
    return NextResponse.json({ data: [], meta: { page, limit, count: 0, totalPages: 1, sort, order }, warning: 'Failed to list resources' })
  }
  return NextResponse.json({ data, meta: { page, limit, count, totalPages: count ? Math.ceil(count / limit) : 1, sort, order } })
}

async function uploadToDrive(fileBuffer: Buffer, fileName: string, mime: string, description?: string) {
  const settings = await getSettings()
  const driveFolderId = settings?.drive_folder_id || process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!driveFolderId) throw new Error('Drive folder id not configured')
  // Support base64 JSON (e.g. on Vercel) or local key file
  const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  let auth: any
  if (rawB64) {
    // Decode and parse service account JSON
    const raw = Buffer.from(rawB64, 'base64').toString('utf8')
    const creds = JSON.parse(raw)
    creds.private_key = creds.private_key.replace(/\\n/g, '\n')
    auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive'] })
  } else if (keyFile) {
    // Load from file path
    auth = new google.auth.GoogleAuth({ keyFilename: keyFile, scopes: ['https://www.googleapis.com/auth/drive'] })
  } else {
    throw new Error('Google Drive configuration error: no credentials provided')
  }
  const drive = google.drive({ version: 'v3', auth })
  const fileReadable = Readable.from(fileBuffer)
  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [driveFolderId], description },
    media: { mimeType: mime || 'application/pdf', body: fileReadable },
    fields: 'id,webViewLink',
  })
  if (!data.id) throw new Error('Drive upload failed')
  await drive.permissions.create({ fileId: data.id, requestBody: { role: 'reader', type: 'anyone' } })
  const url = data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view?usp=sharing`
  return { url }
}

async function uploadToStorage(fileBuffer: Buffer, fileName: string, mime?: string) {
  const settings = await getSettings()
  const bucket = settings?.storage_bucket || 'resources'
  const supabase = createSupabaseAdmin()
  const uploadPath = `${Date.now()}-${fileName}`
  const { error } = await supabase.storage.from(bucket).upload(uploadPath, fileBuffer, { contentType: mime || undefined, duplex: 'half' as any })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
  return { url: data.publicUrl }
}

export async function POST(request: Request) {
  const REQ_DEBUG_PREFIX = '[API DEBUG AdminResources POST]';
  console.log(`${REQ_DEBUG_PREFIX} Received POST request at ${new Date().toISOString()}`);

  // Check permissions - allow admins and representatives
  let userContext;
  try {
    userContext = await requirePermission('write', 'resources');
    console.log(`${REQ_DEBUG_PREFIX} User authorized: ${userContext.email}, Role: ${userContext.role}`);
  } catch (error: any) {
    console.error(`${REQ_DEBUG_PREFIX} Authorization failed:`, error.message);
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();
  const contentType = request.headers.get('content-type') || '';

  try {
    let payload: any = {};
    let file: File | null = null;
    // Track resolved ids for insertion
    let branchId: string | null = null;
    let yearId: string | null = null;
    let semesterId: string | null = null;

    console.log(`${REQ_DEBUG_PREFIX} Content-Type: ${contentType}`);

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const required = ['category', 'subject', 'unit', 'name'] as const;
      for (const k of form.keys()) payload[k] = form.get(k);
      for (const k of required) {
        if (!payload[k]) {
          console.error(`${REQ_DEBUG_PREFIX} Missing required form field: ${k}`);
          return NextResponse.json({ error: `Missing field ${k}` }, { status: 400 });
        }
      }
      file = (form.get('file') as unknown as File) || null;
      branchId = payload.branch_id || null;
      yearId = payload.year_id || null;
      semesterId = payload.semester_id || null;
      console.log(`${REQ_DEBUG_PREFIX} Parsed FormData: file presence=${!!file}, payload keys: ${Object.keys(payload).join(', ')}`);
    } else {
      payload = await request.json();
      const required = ['category', 'subject', 'unit', 'name'] as const;
      for (const k of required) {
        if (!payload[k]) {
          console.error(`${REQ_DEBUG_PREFIX} Missing required JSON field: ${k}`);
          return NextResponse.json({ error: `Missing field ${k}` }, { status: 400 });
        }
      }
      branchId = payload.branch_id || null;
      yearId = payload.year_id || null;
      semesterId = payload.semester_id || null;
      console.log(`${REQ_DEBUG_PREFIX} Parsed JSON payload: keys: ${Object.keys(payload).join(', ')}`);
    }

    const unit = toInt(payload.unit);
    if (!unit || unit < 1) {
      console.error(`${REQ_DEBUG_PREFIX} Invalid unit value: ${payload.unit}`);
      return NextResponse.json({ error: 'Invalid unit' }, { status: 400 });
    }
    console.log(`${REQ_DEBUG_PREFIX} Validated unit: ${unit}`);

    // Enforce scope for representatives early to avoid uploading files when the request will be rejected
    if (userContext.role === 'representative') {
      console.log(`${REQ_DEBUG_PREFIX} User is a representative. Checking resource management permissions.`);
      // If branch/year not provided, infer from their assigned representative records
      if (!branchId || !yearId) {
        const firstAssignment = (userContext.representatives && userContext.representatives[0]) || null;
        if (firstAssignment) {
          branchId = firstAssignment.branch_id || branchId;
          yearId = firstAssignment.year_id || yearId;
          console.log(`${REQ_DEBUG_PREFIX} Inferred branchId: ${branchId}, yearId: ${yearId} for representative.`);
        }
      }
      if (!branchId || !yearId) {
        console.error(`${REQ_DEBUG_PREFIX} Branch and year not specified for representative.`);
        return NextResponse.json({ error: 'Branch and year must be specified for representatives' }, { status: 400 });
      }
      const canManage = await canManageResources(branchId, yearId);
      if (!canManage) {
        console.error(`${REQ_DEBUG_PREFIX} Representative forbidden from managing resources for branchId: ${branchId}, yearId: ${yearId}.`);
        return NextResponse.json({ error: 'Forbidden: Cannot manage resources for this branch/year' }, { status: 403 });
      }
      console.log(`${REQ_DEBUG_PREFIX} Representative authorized to manage resources for branchId: ${branchId}, yearId: ${yearId}.`);
    }

    let url: string | undefined;
    let is_pdf = false;
    let detectedMime: string | null = null;

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
      detectedMime = effectiveMime;
      is_pdf = effectiveMime === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
      console.log(`${REQ_DEBUG_PREFIX} Effective MIME: ${effectiveMime}, Is PDF: ${is_pdf}.`);

      const settings = await getSettings();
      if (is_pdf && settings?.pdf_to_drive) {
        console.log(`${REQ_DEBUG_PREFIX} Uploading PDF to Google Drive.`);
        const uploaded = await uploadToDrive(buffer, originalName, effectiveMime, payload.description || undefined);
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
      is_pdf = url.toLowerCase().includes('drive.google.com') || url.toLowerCase().endsWith('.pdf');
      console.log(`${REQ_DEBUG_PREFIX} URL provided: ${url}, Is PDF: ${is_pdf}.`);
    } else {
      console.error(`${REQ_DEBUG_PREFIX} Neither file nor URL provided.`);
      return NextResponse.json({ error: 'Either file or url is required' }, { status: 400 });
    }

    const insertPayload: any = {
      category: String(payload.category),
      subject: String(payload.subject).toLowerCase(),
      unit,
      name: String(payload.name),
      description: payload.description ? String(payload.description) : null,
      type: payload.type ? String(payload.type) : null,
      year: payload.year ? toInt(payload.year) : null,
      branch: payload.branch || null,
      archived: Boolean(payload.archived) || false,
      semester: payload.semester ? toInt(payload.semester) : null,
      url: url!,
      is_pdf,
    };
    console.log(`${REQ_DEBUG_PREFIX} Initial insertPayload:`, insertPayload);

    // Resolve and attach id fields and audit metadata
    if (!branchId && payload.branch) {
      console.log(`${REQ_DEBUG_PREFIX} Resolving branchId for branch: ${payload.branch}.`);
      const { data: branchData } = await supabase
        .from('branches')
        .select('id')
        .eq('code', payload.branch)
        .single();
      branchId = branchData?.id || branchId;
      console.log(`${REQ_DEBUG_PREFIX} Resolved branchId: ${branchId}.`);
    }
    if (!yearId && payload.year) {
      console.log(`${REQ_DEBUG_PREFIX} Resolving yearId for year: ${payload.year}.`);
      const { data: yearData } = await supabase
        .from('years')
        .select('id')
        .eq('batch_year', payload.year)
        .single();
      yearId = yearData?.id || yearId;
      console.log(`${REQ_DEBUG_PREFIX} Resolved yearId: ${yearId}.`);
    }

    insertPayload['branch_id'] = branchId;
    insertPayload['year_id'] = yearId;
    insertPayload['semester_id'] = semesterId;
    // Resolve uploader_id: prefer UUID; if userContext.id is not a UUID, try to look up profile id by email
    // Resolve uploader_id: only set if the user corresponds to a student record
    let resolvedUploaderId: string | null = null;
    try {
      if (userContext?.email) {
        const { data: studentRecord } = await supabase.from('students').select('id').eq('email', userContext.email).maybeSingle();
        if (studentRecord && studentRecord.id) resolvedUploaderId = studentRecord.id;
      }
    } catch (e) {
      console.warn(`${REQ_DEBUG_PREFIX} Student lookup failed for uploader resolution:`, e);
    }
    insertPayload['uploader_id'] = resolvedUploaderId;

    // created_by must reference admins.id (foreign key). Only set if the user is an admin.
    let resolvedCreatedBy: string | null = null;
    try {
      if (userContext?.email) {
        const { data: adminRecord } = await supabase.from('admins').select('id').eq('email', userContext.email).maybeSingle();
        if (adminRecord && adminRecord.id) resolvedCreatedBy = adminRecord.id;
      }
    } catch (e) {
      console.warn(`${REQ_DEBUG_PREFIX} Admin lookup failed for created_by resolution:`, e);
    }
    insertPayload['created_by'] = resolvedCreatedBy;
    insertPayload['file_type'] = detectedMime || ((file as any)?.type || null);
    insertPayload['title'] = payload.title ? String(payload.title) : String(payload.name);
    // For Drive uploads, store drive link separately if the url is a Drive link
    insertPayload['drive_link'] = url && url.toLowerCase().includes('drive.google.com') ? url : null;

    // Debug: print resolved user and payload to help diagnose uuid insertion errors
    console.debug(`${REQ_DEBUG_PREFIX} Creating resource - userContext:`, { id: (userContext as any)?.id, email: userContext?.email, role: userContext?.role });
    console.debug(`${REQ_DEBUG_PREFIX} Creating resource - insertPayload preview:`, {
      branch_id: insertPayload['branch_id'],
      year_id: insertPayload['year_id'],
      uploader_id: insertPayload['uploader_id'],
      created_by: insertPayload['created_by']
    });
    const { data, error } = await supabase.from('resources').insert(insertPayload).select('id').single();
    if (error) {
      console.error(`${REQ_DEBUG_PREFIX} Database insertion error:`, error);
      throw error;
    }
    console.log(`${REQ_DEBUG_PREFIX} Database insertion successful. New resource ID: ${data.id}.`);
    
    // Log the audit with proper role handling
    const auditRole = userContext.role === 'representative' ? 'admin' : userContext.role as 'admin' | 'superadmin';
    await logAudit({
      actor_email: userContext.email,
      actor_role: auditRole,
      action: 'create',
      entity: 'resource',
      entity_id: data.id,
      after_data: insertPayload
    });
    console.log(`${REQ_DEBUG_PREFIX} Audit log created for resource ID: ${data.id}.`);
    
    return NextResponse.json({ id: data.id, ...insertPayload });
  } catch (err: any) {
    // Log error to server console for debugging
    console.error(`${REQ_DEBUG_PREFIX} Create resource error:`, err);
    const auditRole = userContext?.role === 'representative' ? 'admin' : userContext?.role as 'admin' | 'superadmin' || 'admin';
    await logAudit({
      actor_email: userContext?.email || 'unknown',
      actor_role: auditRole,
      action: 'create',
      entity: 'resource',
      success: false,
      message: err?.message
    });
    // In development, return error message to client to aid debugging; keep generic in production
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ error: 'Failed to create resource', reason: err?.message || String(err) }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}


