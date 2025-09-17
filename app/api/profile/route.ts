// Updated Profile API Route for New Schema
// This file contains the updated implementation that works with the refactored database schema
// Replace the existing route.ts with this content after migration is complete

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
import { academicConfig } from '@/lib/academic-config';

const supabaseAdmin = createSupabaseAdmin();

// Helper function to dynamically calculate academic year level from batch year
async function calculateYearLevel(batchYear: number | undefined): Promise<number> {
  return academicConfig.calculateAcademicYear(batchYear);
}

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

interface ProfilePayload {
  name: string;
  branch_id: string;
  year_id: string;
  semester_id: string;
  roll_number: string;
  section?: string;
}

function validatePayload(body: any): { ok: true; data: ProfilePayload } | { ok: false; error: string } {
  const { name, branch_id, year_id, semester_id, roll_number, section } = body;

  if (!name || typeof name !== 'string') return { ok: false, error: 'Name is required and must be a string' };
  if (!branch_id || typeof branch_id !== 'string') return { ok: false, error: 'Branch ID is required and must be a string' };
  if (!year_id || typeof year_id !== 'string') return { ok: false, error: 'Year ID is required and must be a string' };
  if (!semester_id || typeof semester_id !== 'string') return { ok: false, error: 'Semester ID is required and must be a string' };
  if (!roll_number || typeof roll_number !== 'string') return { ok: false, error: 'Roll number is required and must be a string' };

  return { ok: true, data: { name, branch_id, year_id, semester_id, roll_number, section } };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();

  // Query the profiles table once for all needed data
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

  // Transform to include legacy format for backward compatibility
  let profile = null as any;
  if (profileData) {
    const base = profileData as any;

    // Safely enrich with branch code and batch year without relationship expansion
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
    const calculatedYear = batchYear ? await calculateYearLevel(batchYear) : 1;

    profile = {
      ...base,
      year: calculatedYear,
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
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const payload = { email, ...validation.data };

  // Validate foreign key references before inserting
  const [branchCheck, yearCheck, semesterCheck] = await Promise.all([
    supabase.from('branches').select('id').eq('id', payload.branch_id).maybeSingle(),
    supabase.from('years').select('id').eq('id', payload.year_id).maybeSingle(),
    supabase.from('semesters').select('id').eq('id', payload.semester_id).maybeSingle()
  ]);

  // Check for database errors first
  if (branchCheck.error) {
    console.error('Branch validation error:', branchCheck.error);
    return NextResponse.json({
      error: 'Database error during branch validation',
      details: branchCheck.error.message
    }, { status: 500 });
  }
  if (yearCheck.error) {
    console.error('Year validation error:', yearCheck.error);
    return NextResponse.json({
      error: 'Database error during year validation',
      details: yearCheck.error.message
    }, { status: 500 });
  }
  if (semesterCheck.error) {
    console.error('Semester validation error:', semesterCheck.error);
    return NextResponse.json({
      error: 'Database error during semester validation',
      details: semesterCheck.error.message
    }, { status: 500 });
  }

  // Check for missing records
  if (!branchCheck.data) {
    return NextResponse.json({ error: 'Invalid branch ID' }, { status: 422 });
  }
  if (!yearCheck.data) {
    return NextResponse.json({ error: 'Invalid year ID' }, { status: 422 });
  }
  if (!semesterCheck.data) {
    return NextResponse.json({ error: 'Invalid semester ID' }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('email', email)
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
    // Log the error for debugging (with sanitized payload)
    console.error('Profile update error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload: sanitizeForLogging(payload),
      userId: email // Safe identifier for debugging
    });

    // Handle uniqueness violations (e.g., roll_number)
    const isUniqueViolation = 'code' in error && typeof error.code === 'string' && error.code === '23505';
    const message = isUniqueViolation ? 'Roll number or email already exists' : 'Database error';
    return NextResponse.json({
      error: message,
      details: error.message,
      code: error.code
    }, { status: 400 });
  }

  // Enrich without relationship expansion
  const base = data as any;

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
  const calculatedYear = batchYear ? await calculateYearLevel(batchYear) : 1;

  const profile = {
    ...base,
    year: calculatedYear,
    branch: branchCode || 'Unknown',
    role: userRole
  };

  return NextResponse.json({ profile });
}


