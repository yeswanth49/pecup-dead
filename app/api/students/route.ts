// Students API Route
// Manages student records with new schema

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Student, StudentFilters } from '@/lib/types';

const supabaseAdmin = createSupabaseAdmin();

export async function GET(request: Request) {
  try {
    // Require admin access to view all students
    await requireAdmin('admin');
    
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
    
    const body = await request.json();
    const { roll_number, name, email, branch_id, year_id, semester_id, section } = body;

    if (!roll_number || !name || !email || !branch_id || !year_id || !semester_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: roll_number, name, email, branch_id, year_id, semester_id' 
      }, { status: 400 });
    }

    // Validate foreign key references
    const [branchCheck, yearCheck, semesterCheck] = await Promise.all([
      supabaseAdmin.from('branches').select('id').eq('id', branch_id).maybeSingle(),
      supabaseAdmin.from('years').select('id').eq('id', year_id).maybeSingle(),
      supabaseAdmin.from('semesters').select('id').eq('id', semester_id).eq('year_id', year_id).maybeSingle()
    ]);

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
