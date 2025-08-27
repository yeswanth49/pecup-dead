// Updated Profile API Route for New Schema
// This file contains the updated implementation that works with the refactored database schema
// Replace the existing route.ts with this content after migration is complete

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Student, StudentCreateInput, StudentUpdateInput } from '@/lib/types';

const supabaseAdmin = createSupabaseAdmin();

// Helper function to map batch year to year level
function mapBatchYearToYearLevel(batchYear: number | undefined): number {
  if (!batchYear) return 1;
  switch (batchYear) {
    case 2024: return 1;
    case 2023: return 2;
    case 2022: return 3;
    case 2021: return 4;
    default: return 1;
  }
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

  // Query the new students table with relationships
  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      roll_number,
      name,
      email,
      branch_id,
      year_id,
      semester_id,
      section,
      created_at,
      updated_at,
      branch:branches(id, name, code),
      year:years(id, batch_year, display_name),
      semester:semesters(id, semester_number)
    `)
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  // Transform to include legacy format for backward compatibility
  let profile = null;
  if (data) {
    profile = {
      ...data,
      // Legacy compatibility fields
      year: mapBatchYearToYearLevel((data.year as any)?.batch_year),
      branch: (data.branch as any)?.code || '',
      role: 'student' as const
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
    .from('students')
    .upsert(payload, { onConflict: 'email' })
    .select(`
      id,
      roll_number,
      name,
      email,
      branch_id,
      year_id,
      semester_id,
      section,
      created_at,
      updated_at,
      branch:branches(id, name, code),
      year:years(id, batch_year, display_name),
      semester:semesters(id, semester_number)
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
    const isUniqueViolation = (error as any)?.code === '23505';
    const message = isUniqueViolation ? 'Roll number or email already exists' : 'Database error';
    return NextResponse.json({
      error: message,
      details: error.message,
      code: error.code
    }, { status: 400 });
  }

  // Transform response for backward compatibility
  const profile = {
    ...data,
    // Legacy compatibility fields
    year: mapBatchYearToYearLevel((data.year as any)?.batch_year),
    branch: (data.branch as any)?.code || '',
    role: 'student' as const
  };

  return NextResponse.json({ profile });
}


