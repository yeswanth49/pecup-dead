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
    console.log(`[API DEBUG AdminResources GET] User context: ${JSON.stringify({ role: userContext?.role, email: userContext?.email, representatives: userContext?.representatives?.map(r => ({ branch_id: r.branch_id, year_id: r.year_id, active: r.active })) })}`);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admins and representatives to access this admin endpoint
    if (!userContext.role || !['admin', 'yeshh', 'representative'].includes(userContext.role)) {
      console.log(`[API DEBUG AdminResources GET] Forbidden: role '${userContext.role}' not in allowed list`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (err) {
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.log(`[API DEBUG AdminResources GET] Error in getCurrentUserContext: ${err}`);
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
    } else if (userContext.role === 'admin' && userContext.branchId && userContext.yearId) {
      // Restricted admins can only see resources for their assigned branch/year
      query = query.eq('branch_id', userContext.branchId).eq('year_id', userContext.yearId)
    }
    // Yeshh and unrestricted admins see everything
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
  console.log(`[API DEBUG uploadToDrive] Starting Google Drive upload:`, {
    fileName,
    mime,
    bufferSize: fileBuffer.length,
    description: !!description
  });

  const settings = await getSettings()
  const driveFolderId = settings?.drive_folder_id || process.env.GOOGLE_DRIVE_FOLDER_ID
  console.log(`[API DEBUG uploadToDrive] Drive configuration:`, {
    driveFolderId: driveFolderId ? 'configured' : 'missing',
    settingsSource: settings?.drive_folder_id ? 'settings' : 'env'
  });

  if (!driveFolderId) {
    console.error(`[API DEBUG uploadToDrive] Drive folder ID not configured`);
    throw new Error('Drive folder id not configured')
  }

  // Support base64 JSON (e.g. on Vercel) or local key file
  const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  let auth: any

  console.log(`[API DEBUG uploadToDrive] Auth configuration:`, {
    hasBase64: !!rawB64,
    hasKeyFile: !!keyFile,
    authMethod: rawB64 ? 'base64' : keyFile ? 'keyFile' : 'none'
  });

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
    console.error(`[API DEBUG uploadToDrive] No Google credentials configured`);
    throw new Error('Google Drive configuration error: no credentials provided')
  }

  const drive = google.drive({ version: 'v3', auth })
  const fileReadable = Readable.from(fileBuffer)

  console.log(`[API DEBUG uploadToDrive] Creating Drive file with metadata:`, {
    name: fileName,
    parents: [driveFolderId],
    description: description || 'none'
  });

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [driveFolderId], description },
    media: { mimeType: mime || 'application/pdf', body: fileReadable },
    fields: 'id,webViewLink',
  })

  console.log(`[API DEBUG uploadToDrive] Drive file created:`, {
    id: data.id,
    webViewLink: data.webViewLink,
    hasId: !!data.id
  });

  if (!data.id) {
    console.error(`[API DEBUG uploadToDrive] Drive upload failed - no file ID returned`);
    throw new Error('Drive upload failed')
  }

  console.log(`[API DEBUG uploadToDrive] Setting public permissions for file: ${data.id}`);
  await drive.permissions.create({ fileId: data.id, requestBody: { role: 'reader', type: 'anyone' } })

  const url = data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view?usp=sharing`
  console.log(`[API DEBUG uploadToDrive] Upload completed successfully:`, { url });

  return { url }
}

async function uploadToStorage(fileBuffer: Buffer, fileName: string, mime?: string) {
  console.log(`[API DEBUG uploadToStorage] Starting Supabase Storage upload:`, {
    fileName,
    mime,
    bufferSize: fileBuffer.length,
    bufferSizeFormatted: `${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`
  });

  const settings = await getSettings()
  const bucket = settings?.storage_bucket || 'resources'
  console.log(`[API DEBUG uploadToStorage] Storage configuration:`, {
    bucket,
    settingsSource: settings?.storage_bucket ? 'settings' : 'default'
  });

  const supabase = createSupabaseAdmin()
  const uploadPath = `${Date.now()}-${fileName}`
  console.log(`[API DEBUG uploadToStorage] Generated upload path:`, { uploadPath });

  const { error } = await supabase.storage.from(bucket).upload(uploadPath, fileBuffer, {
    contentType: mime || undefined,
    duplex: 'half' as any
  })

  if (error) {
    console.error(`[API DEBUG uploadToStorage] Upload failed:`, {
      error,
      errorMessage: error.message,
      uploadPath,
      bucket,
      mime
    });
    throw error
  }

  console.log(`[API DEBUG uploadToStorage] File uploaded successfully to storage path:`, uploadPath);

  const { data } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
  console.log(`[API DEBUG uploadToStorage] Public URL generated:`, {
    publicUrl: data.publicUrl,
    bucket,
    uploadPath
  });

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

  let payload: any = {};
  let file: File | null = null;

  try {
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
      // Normalize incoming ID fields: accept snake_case, camelCase, or legacy display values
      branchId = payload.branch_id || payload.branchId || payload.branch || null;
      yearId = payload.year_id || payload.yearId || payload.year || null;
      semesterId = payload.semester_id || payload.semesterId || payload.semester || null;
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
      // Normalize incoming ID fields for JSON body as well
      branchId = payload.branch_id || payload.branchId || payload.branch || null;
      yearId = payload.year_id || payload.yearId || payload.year || null;
      semesterId = payload.semester_id || payload.semesterId || payload.semester || null;
      console.log(`${REQ_DEBUG_PREFIX} Parsed JSON payload: keys: ${Object.keys(payload).join(', ')}`);
    }

    const unit = toInt(payload.unit);
    if (!unit || unit < 1) {
      console.error(`${REQ_DEBUG_PREFIX} Invalid unit value: ${payload.unit}`);
      return NextResponse.json({ error: 'Invalid unit' }, { status: 400 });
    }
    console.log(`${REQ_DEBUG_PREFIX} Validated unit: ${unit}`);

    // Enforce scope for representatives and restricted admins
    let unrestricted = payload.unrestricted === true || payload.unrestricted === 'true';

    if (userContext.role === 'representative' || (userContext.role === 'admin' && !unrestricted)) {
      if (userContext.role === 'representative') {
        console.log(`${REQ_DEBUG_PREFIX} User is a representative. Checking resource management permissions.`);
      } else {
        console.log(`${REQ_DEBUG_PREFIX} User is an admin with restricted access. Checking resource management permissions.`);
      }
      // If branch/year not provided, infer from their assigned records
      if (!branchId || !yearId) {
        if (userContext.role === 'representative') {
          const firstAssignment = (userContext.representatives && userContext.representatives[0]) || null;
          if (firstAssignment) {
            branchId = firstAssignment.branch_id || branchId;
            yearId = firstAssignment.year_id || yearId;
            console.log(`${REQ_DEBUG_PREFIX} Inferred branchId: ${branchId}, yearId: ${yearId} for representative.`);
          }
        } else if (userContext.role === 'admin') {
          branchId = userContext.branchId || branchId;
          yearId = userContext.yearId || yearId;
          console.log(`${REQ_DEBUG_PREFIX} Inferred branchId: ${branchId}, yearId: ${yearId} for admin.`);
        }
      }
      if (!branchId || !yearId) {
        const roleName = userContext.role === 'representative' ? 'representatives' : 'admins';
        console.error(`${REQ_DEBUG_PREFIX} Branch and year not specified for ${roleName}.`);
        return NextResponse.json({ error: `Branch and year must be specified for ${roleName}` }, { status: 400 });
      }
      console.log(`${REQ_DEBUG_PREFIX} Checking permissions for ${userContext.role}. userContext: ${JSON.stringify({ role: userContext.role, branchId: userContext.branchId, yearId: userContext.yearId, representatives: userContext.representatives?.map(r => ({ branch_id: r.branch_id, year_id: r.year_id, active: r.active })) })}`);
      console.log(`${REQ_DEBUG_PREFIX} Target branchId: ${branchId}, yearId: ${yearId}`);
      const canManage = await canManageResources(branchId, yearId);
      console.log(`${REQ_DEBUG_PREFIX} canManage result: ${canManage}`);
      if (!canManage) {
        console.error(`${REQ_DEBUG_PREFIX} ${userContext.role} forbidden from managing resources for branchId: ${branchId}, yearId: ${yearId}.`);
        return NextResponse.json({ error: 'Forbidden: Cannot manage resources for this branch/year' }, { status: 403 });
      }
      console.log(`${REQ_DEBUG_PREFIX} ${userContext.role} authorized to manage resources for branchId: ${branchId}, yearId: ${yearId}.`);
    } else if (userContext.role === 'admin' && unrestricted) {
      console.log(`${REQ_DEBUG_PREFIX} Admin with unrestricted access. Skipping scope checks.`);
    }

    let url: string | undefined;
    let is_pdf = false;
    let detectedMime: string | null = null;

    if (file) {
      console.log(`${REQ_DEBUG_PREFIX} File upload process started.`);
      const originalName = (file as any).name as string;
      const clientMime = (file as any).type as string | undefined;
      const size = (file as any).size as number | undefined;
      console.log(`${REQ_DEBUG_PREFIX} File details extracted:`, {
        name: originalName,
        clientMime,
        size,
        sizeFormatted: size ? `${(size / 1024 / 1024).toFixed(2)} MB` : 'unknown'
      });

      if (typeof size === 'number' && size > MAX_UPLOAD_BYTES) {
        console.error(`${REQ_DEBUG_PREFIX} File size validation failed:`, {
          size,
          maxSize: MAX_UPLOAD_BYTES,
          sizeFormatted: `${(size / 1024 / 1024).toFixed(2)} MB`,
          maxSizeFormatted: `${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(2)} MB`
        });
        return NextResponse.json({ error: 'File too large' }, { status: 413 });
      }

      console.log(`${REQ_DEBUG_PREFIX} Converting file to buffer for validation.`);
      const buffer = Buffer.from(await file.arrayBuffer());
      console.log(`${REQ_DEBUG_PREFIX} File buffer created, size:`, buffer.length);

      const validation = validateFile(buffer, originalName, clientMime);
      console.log(`${REQ_DEBUG_PREFIX} File validation result:`, {
        ok: validation.ok,
        reason: validation.reason,
        detectedMime: validation.detectedMime
      });

      if (!validation.ok) {
        console.error(`${REQ_DEBUG_PREFIX} File validation failed, rejecting upload.`);
        return NextResponse.json({ error: 'Unsupported file type', reason: validation.reason }, { status: 415 });
      }

      const effectiveMime = (validation.detectedMime || clientMime || '').toLowerCase();
      detectedMime = effectiveMime;
      is_pdf = effectiveMime === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
      console.log(`${REQ_DEBUG_PREFIX} MIME type determination:`, {
        effectiveMime,
        is_pdf,
        detectedMime: validation.detectedMime,
        clientMime
      });

      const settings = await getSettings();
      console.log(`${REQ_DEBUG_PREFIX} Upload destination decision:`, {
        is_pdf,
        pdf_to_drive: settings?.pdf_to_drive,
        destination: (is_pdf && settings?.pdf_to_drive) ? 'Google Drive' : 'Supabase Storage'
      });

      if (is_pdf && settings?.pdf_to_drive) {
        console.log(`${REQ_DEBUG_PREFIX} Starting Google Drive upload process.`);
        try {
          const uploaded = await uploadToDrive(buffer, originalName, effectiveMime, payload.description || undefined);
          url = uploaded.url;
          console.log(`${REQ_DEBUG_PREFIX} Google Drive upload completed successfully:`, {
            url,
            fileName: originalName,
            mime: effectiveMime,
            description: payload.description
          });
        } catch (uploadError) {
          console.error(`${REQ_DEBUG_PREFIX} Google Drive upload failed:`, uploadError);
          throw uploadError;
        }
      } else {
        console.log(`${REQ_DEBUG_PREFIX} Starting Supabase Storage upload process.`);
        try {
          const uploaded = await uploadToStorage(buffer, originalName, effectiveMime);
          url = uploaded.url;
          console.log(`${REQ_DEBUG_PREFIX} Supabase Storage upload completed successfully:`, {
            url,
            fileName: originalName,
            mime: effectiveMime
          });
        } catch (uploadError) {
          console.error(`${REQ_DEBUG_PREFIX} Supabase Storage upload failed:`, uploadError);
          throw uploadError;
        }
      }
    } else if (payload.url) {
      url = String(payload.url);
      is_pdf = url.toLowerCase().includes('drive.google.com') || url.toLowerCase().endsWith('.pdf');
      console.log(`${REQ_DEBUG_PREFIX} External URL provided, skipping upload:`, {
        url,
        is_pdf,
        urlType: url.toLowerCase().includes('drive.google.com') ? 'Google Drive' : 'Other'
      });
    } else {
      console.error(`${REQ_DEBUG_PREFIX} No file or URL provided for resource creation.`);
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
    console.log(`${REQ_DEBUG_PREFIX} Starting ID resolution process`, {
      initialIds: { branchId, yearId, semesterId },
      payloadValues: { branch: payload.branch, year: payload.year, semester: payload.semester }
    })

    if (!branchId && payload.branch) {
      console.log(`${REQ_DEBUG_PREFIX} Resolving branchId for branch: ${payload.branch}.`);
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('code', payload.branch)
        .single();
      if (branchError) {
        console.error(`${REQ_DEBUG_PREFIX} Branch resolution query failed:`, branchError);
      }
      branchId = branchData?.id || branchId;
      console.log(`${REQ_DEBUG_PREFIX} Branch resolution completed`, {
        input: payload.branch,
        resolvedId: branchId,
        queryResult: branchData,
        error: branchError
      });
    }
    if (!yearId && payload.year) {
      console.log(`${REQ_DEBUG_PREFIX} Resolving yearId for year: ${payload.year}.`);
      const { data: yearData, error: yearError } = await supabase
        .from('years')
        .select('id')
        .eq('batch_year', payload.year)
        .single();
      if (yearError) {
        console.error(`${REQ_DEBUG_PREFIX} Year resolution query failed:`, yearError);
      }
      yearId = yearData?.id || yearId;
      console.log(`${REQ_DEBUG_PREFIX} Year resolution completed`, {
        input: payload.year,
        resolvedId: yearId,
        queryResult: yearData,
        error: yearError
      });
    }

    // Log semester resolution if needed
    if (!semesterId && payload.semester && yearId) {
      console.log(`${REQ_DEBUG_PREFIX} Resolving semesterId for semester: ${payload.semester} in yearId: ${yearId}.`);
      const { data: semesterData, error: semesterError } = await supabase
        .from('semesters')
        .select('id')
        .eq('year_id', yearId)
        .eq('semester_number', payload.semester)
        .single();
      if (semesterError) {
        console.error(`${REQ_DEBUG_PREFIX} Semester resolution query failed:`, semesterError);
      }
      semesterId = semesterData?.id || semesterId;
      console.log(`${REQ_DEBUG_PREFIX} Semester resolution completed`, {
        input: { yearId, semester: payload.semester },
        resolvedId: semesterId,
        queryResult: semesterData,
        error: semesterError
      });
    }

    insertPayload['branch_id'] = branchId;
    insertPayload['year_id'] = yearId;
    insertPayload['semester_id'] = semesterId;
    // Resolve uploader_id: prefer UUID; if userContext.id is not a UUID, try to look up profile id by email
    // Resolve uploader_id from profiles
    let resolvedUploaderId: string | null = null;
    try {
      if (userContext?.email) {
        const { data: profileRecord } = await supabase.from('profiles').select('id').eq('email', userContext.email).maybeSingle();
        if (profileRecord && profileRecord.id) resolvedUploaderId = profileRecord.id;
      }
    } catch (e) {
      console.warn(`${REQ_DEBUG_PREFIX} Profile lookup failed for uploader resolution:`, e);
    }
    insertPayload['uploader_id'] = resolvedUploaderId;

    // created_by now references profiles.id for admins/yeshh
    let resolvedCreatedBy: string | null = null;
    try {
      if (userContext?.email && (userContext.role === 'admin' || userContext.role === 'yeshh')) {
        const { data: adminProfile } = await supabase.from('profiles').select('id').eq('email', userContext.email).maybeSingle();
        resolvedCreatedBy = adminProfile?.id || null;
      }
    } catch (e) {
      console.warn(`${REQ_DEBUG_PREFIX} Profile lookup failed for created_by resolution:`, e);
    }
    insertPayload['created_by'] = resolvedCreatedBy;
    insertPayload['file_type'] = detectedMime || ((file as any)?.type || null);
    insertPayload['title'] = payload.title ? String(payload.title) : String(payload.name);
    // For Drive uploads, store drive link separately if the url is a Drive link
    insertPayload['drive_link'] = url && url.toLowerCase().includes('drive.google.com') ? url : null;

    // Debug: print resolved user and payload to help diagnose uuid insertion errors
    console.log(`${REQ_DEBUG_PREFIX} Preparing database insertion:`, {
      userContext: { id: (userContext as any)?.id, email: userContext?.email, role: userContext?.role },
      finalResolvedIds: {
        branch_id: insertPayload['branch_id'],
        year_id: insertPayload['year_id'],
        semester_id: insertPayload['semester_id'],
        uploader_id: insertPayload['uploader_id'],
        created_by: insertPayload['created_by']
      },
      insertPayloadKeys: Object.keys(insertPayload),
      insertPayloadSize: JSON.stringify(insertPayload).length
    });

    console.log(`${REQ_DEBUG_PREFIX} Executing database insert operation.`);
    const { data, error } = await supabase.from('resources').insert(insertPayload).select('id').single();

    if (error) {
      console.error(`${REQ_DEBUG_PREFIX} Database insertion failed:`, {
        error,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        insertPayload: insertPayload
      });
      throw error;
    }

    console.log(`${REQ_DEBUG_PREFIX} Database insertion completed successfully:`, {
      newResourceId: data.id,
      insertedRecord: data,
      url: insertPayload.url,
      is_pdf: insertPayload.is_pdf,
      file_type: insertPayload.file_type
    });
    
    // Log the audit with proper role handling
    const auditRole = userContext.role === 'representative' ? 'admin' : userContext.role as 'admin' | 'yeshh';
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
    console.error(`${REQ_DEBUG_PREFIX} Create resource error caught:`, {
      error: err,
      errorMessage: err?.message,
      errorStack: err?.stack,
      errorName: err?.name,
      userContext: userContext ? {
        email: userContext.email,
        role: userContext.role,
        representatives: userContext.representatives
      } : null,
      payload: contentType.includes('multipart/form-data') ?
        'FormData (keys: ' + (payload && Object.keys(payload).join(', ')) + ')' :
        payload,
      timestamp: new Date().toISOString()
    });

    const auditRole = userContext?.role === 'representative' ? 'admin' : userContext?.role as 'admin' | 'yeshh' || 'admin';
    console.log(`${REQ_DEBUG_PREFIX} Creating audit log for failed resource creation:`, {
      actor_email: userContext?.email || 'unknown',
      actor_role: auditRole,
      entity_id: 'unknown',
      success: false,
      message: err?.message
    });

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
      console.log(`${REQ_DEBUG_PREFIX} Returning detailed error response for development:`, {
        error: err?.message || String(err),
        status: 500,
        nodeEnv: process.env.NODE_ENV
      });
      return NextResponse.json({ error: 'Failed to create resource', reason: err?.message || String(err) }, { status: 500 });
    }

    console.log(`${REQ_DEBUG_PREFIX} Returning generic error response for production:`, {
      status: 500,
      nodeEnv: process.env.NODE_ENV
    });
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}


