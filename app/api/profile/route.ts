import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
import { academicConfig } from '@/lib/academic-config';

// Helper function to sanitize payload for logging
function sanitizeForLogging(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  const sensitiveKeys = ['password', 'email', 'ssn', 'token', 'secret', 'key', 'auth'];
  const sanitized = { ...payload };
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  return sanitized;
}

function maskEmail(e?: string | null) {
  if (!e) return '[unknown]';
  const [u, d] = e.split('@');
  return `${u?.slice(0, 2) || ''}***@${d || ''}`;
}

interface ProfilePayload {
  name: string;
  branch_id: string;
  year_id?: string;
  academic_year_level?: number;
  semester_id: string;
  roll_number: string;
  section?: string;
}

function validatePayload(body: any): { ok: true; data: ProfilePayload } | { ok: false; error: string } {
  const { name, branch_id, year_id, academic_year_level, semester_id, roll_number, section } = body;

  if (!name || typeof name !== 'string') {
    return { ok: false, error: 'Name is required and must be a string' };
  }
  if (!branch_id || typeof branch_id !== 'string') {
    return { ok: false, error: 'Branch ID is required and must be a string' };
  }
  if (!semester_id || typeof semester_id !== 'string') {
    return { ok: false, error: 'Semester ID is required and must be a string' };
  }
  if (!roll_number || typeof roll_number !== 'string') {
    return { ok: false, error: 'Roll number is required and must be a string' };
  }

  // Must have either year_id OR academic_year_level
  if (!year_id && !academic_year_level) {
    return { ok: false, error: 'Either year_id or academic_year_level is required' };
  }

  return { ok: true, data: { name, branch_id, year_id, academic_year_level, semester_id, roll_number, section } };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();

  const { data: profileData, error } = await supabase
    .from('profiles')
    .select(`
      id,
      roll_number,
      name,
      email,
      branch_id,
      year_id,
      semester_id,
      section,
      role,
      created_at,
      updated_at
    `)
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  let profile = null as any;
  if (profileData) {
    const base = profileData as any;

    let branchCode: string | null = null;
    let batchYear: number | null = null;

    if (base.branch_id) {
      const { data: b } = await supabase
        .from('branches')
        .select('code')
        .eq('id', base.branch_id)
        .maybeSingle();
      branchCode = (b as any)?.code ?? null;
    }

    if (base.year_id) {
      const { data: y } = await supabase
        .from('years')
        .select('batch_year')
        .eq('id', base.year_id)
        .maybeSingle();
      batchYear = (y as any)?.batch_year ?? null;
    }

    const userRole = base?.role || 'student';
    const calculatedYear = batchYear ? await academicConfig.calculateAcademicYear(batchYear) : 1;
    const config = await academicConfig.getConfig();
    const validYear = Math.min(config.programLength, calculatedYear);

    if (process.env.NODE_ENV === 'development') {
      console.log('DEBUG: GET Profile year calculation:', {
        batchYear,
        calculatedYear,
        validYear,
        userId: maskEmail(email)
      });
    }

    profile = {
      ...base,
      year: validYear,
      batch_year: batchYear,
      branch: branchCode || 'Unknown',
      role: userRole
    };
  }

  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ error: (validation as any).error }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const payload = validation.data;

  // Determine batch_year and year_id
  let batchYear: number;
  let yearId: string;

  if (payload.year_id) {
    // Option 1: year_id provided directly
    yearId = payload.year_id;

    const { data: yearData, error: yearError } = await supabase
      .from('years')
      .select('batch_year')
      .eq('id', yearId)
      .maybeSingle();

    if (yearError) {
      console.error('Year fetch error:', yearError);
      return NextResponse.json({
        error: 'Database error during year fetch',
        details: yearError.message
      }, { status: 500 });
    }

    if (!yearData) {
      return NextResponse.json({ error: 'Invalid year ID' }, { status: 422 });
    }

    batchYear = yearData.batch_year;

  } else if (payload.academic_year_level) {
    // Option 2: User selected academic year level (1-4)
    const academicYearLevel = payload.academic_year_level;

    if (academicYearLevel < 1 || academicYearLevel > 4) {
      return NextResponse.json({
        error: 'Invalid academic year level (must be 1-4)'
      }, { status: 400 });
    }

    // Calculate batch year from academic level
    batchYear = await academicConfig.academicYearToBatchYear(academicYearLevel);

    // Find or create year record
    const { data: existingYear } = await supabase
      .from('years')
      .select('id')
      .eq('batch_year', batchYear)
      .maybeSingle();

    if (existingYear) {
      yearId = existingYear.id;
    } else {
      // Create new year record
      const { data: newYear, error: createError } = await supabase
        .from('years')
        .insert({
          batch_year: batchYear,
          display_name: `${batchYear}-${batchYear + 4}`,
          program_type: 'btech',
          total_semesters: 8
        })
        .select('id')
        .single();

      if (createError || !newYear) {
        console.error('Failed to create year record:', createError);
        return NextResponse.json({
          error: 'Failed to create year record',
          details: createError?.message
        }, { status: 500 });
      }
      yearId = newYear.id;
    }

    console.log(`DEBUG: Created/found year record - batch_year: ${batchYear}, year_id: ${yearId}`);
  } else {
    return NextResponse.json({
      error: 'Either year_id or academic_year_level must be provided'
    }, { status: 400 });
  }

  // Validate other foreign keys
  const [branchCheck, semesterCheck] = await Promise.all([
    supabase.from('branches').select('id, code').eq('id', payload.branch_id).maybeSingle(),
    supabase.from('semesters').select('id').eq('id', payload.semester_id).maybeSingle()
  ]);

  if (branchCheck.error) {
    console.error('Branch validation error:', branchCheck.error);
    return NextResponse.json({
      error: 'Database error during branch validation',
      details: branchCheck.error.message
    }, { status: 500 });
  }
  if (semesterCheck.error) {
    console.error('Semester validation error:', semesterCheck.error);
    return NextResponse.json({
      error: 'Database error during semester validation',
      details: semesterCheck.error.message
    }, { status: 500 });
  }

  if (!branchCheck.data) {
    return NextResponse.json({ error: 'Invalid branch ID' }, { status: 422 });
  }
  if (!semesterCheck.data) {
    return NextResponse.json({ error: 'Invalid semester ID' }, { status: 422 });
  }

  const branchCode = branchCheck.data.code;

  // Insert profile with batch_year
  const insertPayload = {
    email,
    name: payload.name,
    branch_id: payload.branch_id,
    year_id: yearId,
    semester_id: payload.semester_id,
    roll_number: payload.roll_number,
    section: payload.section || null,
    year: batchYear,  // Store batch_year in profiles.year
    branch: branchCode
  };

  console.log('DEBUG: Profile POST - Insert payload:', sanitizeForLogging(insertPayload));

  const { data, error } = await supabase
    .from('profiles')
    .upsert(insertPayload, { onConflict: 'email' })
    .select(`
      id,
      roll_number,
      name,
      email,
      branch_id,
      year_id,
      semester_id,
      section,
      role,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    console.error('Profile update error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload: sanitizeForLogging(insertPayload),
      userId: maskEmail(email)
    });

    const isUniqueViolation = 'code' in error && typeof error.code === 'string' && error.code === '23505';
    const message = isUniqueViolation ? 'Roll number or email already exists' : 'Database error';

    return NextResponse.json({
      error: message,
      details: error.message,
      code: error.code
    }, { status: 400 });
  }

  // Calculate current academic year for response
  const currentAcademicYear = await academicConfig.calculateAcademicYear(batchYear);
  const config = await academicConfig.getConfig();
  const validYear = Math.min(config.programLength, currentAcademicYear);

  const profile = {
    ...data,
    year: validYear,
    batch_year: batchYear,
    branch: branchCode,
    role: data.role || 'student'
  };

  return NextResponse.json({ profile });
}