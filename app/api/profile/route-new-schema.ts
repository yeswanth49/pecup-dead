// Updated Profile API Route for New Schema
// This file contains the updated implementation that works with the refactored database schema
// Replace the existing route.ts with this content after migration is complete

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Student, StudentCreateInput, StudentUpdateInput } from '@/lib/types';

const supabaseAdmin = createSupabaseAdmin();

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
      year: data.year?.batch_year === 2024 ? 1 : 
            data.year?.batch_year === 2023 ? 2 : 
            data.year?.batch_year === 2022 ? 3 : 
            data.year?.batch_year === 2021 ? 4 : 1,
      branch: data.branch?.code || '',
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

  if (!branchCheck.data) {
    return NextResponse.json({ error: 'Invalid branch ID' }, { status: 400 });
  }
  if (!yearCheck.data) {
    return NextResponse.json({ error: 'Invalid year ID' }, { status: 400 });
  }
  if (!semesterCheck.data) {
    return NextResponse.json({ error: 'Invalid semester ID' }, { status: 400 });
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
    // Log the full error for debugging
    console.error('Profile update error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload
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
    year: data.year?.batch_year === 2024 ? 1 : 
          data.year?.batch_year === 2023 ? 2 : 
          data.year?.batch_year === 2022 ? 3 : 
          data.year?.batch_year === 2021 ? 4 : 1,
    branch: data.branch?.code || '',
    role: 'student' as const
  };

  return NextResponse.json({ profile });
}

// New endpoints for the refactored schema

// GET /api/profile/lookup-data - Get branches, years, semesters for forms
export async function getLookupData() {
  const supabase = createSupabaseAdmin();
  
  const [branchesResult, yearsResult, semestersResult] = await Promise.all([
    supabase.from('branches').select('*').order('code'),
    supabase.from('years').select('*').order('batch_year', { ascending: false }),
    supabase.from('semesters').select(`
      id,
      semester_number,
      year_id,
      year:years(id, batch_year, display_name)
    `).order('year_id, semester_number')
  ]);

  return NextResponse.json({
    branches: branchesResult.data || [],
    years: yearsResult.data || [],
    semesters: semestersResult.data || []
  });
}
