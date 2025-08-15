// Students API Route
// Manages student records with new schema

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Student, StudentFilters } from '@/lib/types';

export async function GET(request: Request) {
  try {
    // Require admin access to view all students
    await requireAdmin('admin');
    
    const supabaseAdmin = createSupabaseAdmin();
    
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Build query with filters
    let query = supabaseAdmin
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
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply filters
    const branch_id = searchParams.get('branch_id');
    if (branch_id) query = query.eq('branch_id', branch_id);
    
    const year_id = searchParams.get('year_id');
    if (year_id) query = query.eq('year_id', year_id);
    
    const semester_id = searchParams.get('semester_id');
    if (semester_id) query = query.eq('semester_id', semester_id);
    
    const section = searchParams.get('section');
    if (section) query = query.eq('section', section);
    
    const search = searchParams.get('search');
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,roll_number.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Students fetch error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ 
      students: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Students API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Require admin access to create students
    await requireAdmin('admin');
    
    const supabaseAdmin = createSupabaseAdmin();
    
    const body = await request.json();
    const { roll_number, name, email, branch_id, year_id, semester_id, section } = body;

    // Basic presence validation
    if (!roll_number || !name || !email || !branch_id || !year_id || !semester_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: roll_number, name, email, branch_id, year_id, semester_id' 
      }, { status: 400 });
    }

    // Enhanced input validation
    const validationErrors: string[] = [];
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      validationErrors.push('Invalid email format');
    }
    
    // Field length constraints
    const trimmedName = name.trim();
    const trimmedRollNumber = roll_number.trim();
    const trimmedEmail = email.trim();
    
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      validationErrors.push('Name must be 1-100 characters');
    }
    if (trimmedRollNumber.length === 0 || trimmedRollNumber.length > 20) {
      validationErrors.push('Roll number must be 1-20 characters');
    }
    if (trimmedEmail.length > 254) {
      validationErrors.push('Email must not exceed 254 characters');
    }
    
    // ID validation
    const parsedBranchId = typeof branch_id === 'string' ? branch_id : String(branch_id);
    const parsedYearId = typeof year_id === 'string' ? year_id : String(year_id);
    const parsedSemesterId = typeof semester_id === 'string' ? semester_id : String(semester_id);
    
    if (!parsedBranchId || parsedBranchId.trim().length === 0) {
      validationErrors.push('Invalid branch ID');
    }
    if (!parsedYearId || parsedYearId.trim().length === 0) {
      validationErrors.push('Invalid year ID');
    }
    if (!parsedSemesterId || parsedSemesterId.trim().length === 0) {
      validationErrors.push('Invalid semester ID');
    }
    
    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validationErrors 
      }, { status: 400 });
    }

    // Validate foreign key references
    const [branchCheck, yearCheck, semesterCheck] = await Promise.all([
      supabaseAdmin.from('branches').select('id').eq('id', branch_id).maybeSingle(),
      supabaseAdmin.from('years').select('id').eq('id', year_id).maybeSingle(),
      supabaseAdmin.from('semesters').select('id').eq('id', semester_id).eq('year_id', year_id).maybeSingle()
    ]);

    // Check for query errors first
    if (branchCheck.error) {
      console.error('Branch validation error:', branchCheck.error.message);
      return NextResponse.json({ error: 'Database error during branch validation' }, { status: 500 });
    }
    if (yearCheck.error) {
      console.error('Year validation error:', yearCheck.error.message);
      return NextResponse.json({ error: 'Database error during year validation' }, { status: 500 });
    }
    if (semesterCheck.error) {
      console.error('Semester validation error:', semesterCheck.error.message);
      return NextResponse.json({ error: 'Database error during semester validation' }, { status: 500 });
    }

    // Check for data existence
    if (!branchCheck.data) {
      return NextResponse.json({ error: 'Invalid branch ID' }, { status: 400 });
    }
    if (!yearCheck.data) {
      return NextResponse.json({ error: 'Invalid year ID' }, { status: 400 });
    }
    if (!semesterCheck.data) {
      return NextResponse.json({ error: 'Invalid semester ID or semester does not belong to the specified year' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('students')
      .insert({
        roll_number,
        name,
        email: email.toLowerCase(),
        branch_id,
        year_id,
        semester_id,
        section
      })
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
      console.error('Student creation error:', error);
      
      // Handle uniqueness violations
      const isUniqueViolation = (error as any)?.code === '23505';
      let message = 'Database error';
      
      if (isUniqueViolation) {
        if (error.message.includes('email')) {
          message = 'Email already exists';
        } else if (error.message.includes('roll_number')) {
          message = 'Roll number already exists';
        } else {
          message = 'Student with this data already exists';
        }
      }
      
      return NextResponse.json({ 
        error: message,
        details: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ student: data }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Students API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
