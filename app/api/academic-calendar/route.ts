// Academic Calendar API Route
// Manages semester progression control for admins

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { AcademicCalendar } from '@/lib/types';

const supabaseAdmin = createSupabaseAdmin();

export async function GET() {
  try {
    // Get current academic calendar
    const { data, error } = await supabaseAdmin
      .from('academic_calendar')
      .select(`
        id,
        current_year_id,
        current_semester_id,
        last_updated,
        updated_by,
        current_year:years(id, batch_year, display_name),
        current_semester:semesters(id, semester_number)
      `)
      .maybeSingle();

    if (error) {
      console.error('Academic calendar fetch error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ calendar: data });
  } catch (error) {
    console.error('Academic calendar API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Require admin access
    const admin = await requireAdmin('admin');
    
    const body = await request.json();
    const { current_year_id, current_semester_id } = body;

    if (!current_year_id || !current_semester_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: current_year_id, current_semester_id' 
      }, { status: 400 });
    }

    // Validate that the year and semester exist and are related
    const { data: semester, error: semesterError } = await supabaseAdmin
      .from('semesters')
      .select('id, year_id')
      .eq('id', current_semester_id)
      .eq('year_id', current_year_id)
      .maybeSingle();

    if (semesterError || !semester) {
      return NextResponse.json({ 
        error: 'Invalid year and semester combination' 
      }, { status: 400 });
    }

    // Update or insert academic calendar (should be singleton)
    const { data, error } = await supabaseAdmin
      .from('academic_calendar')
      .upsert({
        current_year_id,
        current_semester_id,
        last_updated: new Date().toISOString(),
        updated_by: admin.email
      })
      .select(`
        id,
        current_year_id,
        current_semester_id,
        last_updated,
        updated_by,
        current_year:years(id, batch_year, display_name),
        current_semester:semesters(id, semester_number)
      `)
      .single();

    if (error) {
      console.error('Academic calendar update error:', error);
      return NextResponse.json({ 
        error: 'Failed to update academic calendar',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ calendar: data });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Academic calendar API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT endpoint for semester progression
export async function PUT(request: Request) {
  try {
    // Require superadmin access for semester progression
    const admin = await requireAdmin('superadmin');
    
    const body = await request.json();
    const { action } = body;

    if (action !== 'progress_semester') {
      return NextResponse.json({ 
        error: 'Invalid action. Use "progress_semester"' 
      }, { status: 400 });
    }

    // Get current academic calendar
    const { data: currentCalendar, error: fetchError } = await supabaseAdmin
      .from('academic_calendar')
      .select(`
        id,
        current_year_id,
        current_semester_id,
        current_year:years(id, batch_year, display_name),
        current_semester:semesters(id, semester_number, year_id)
      `)
      .maybeSingle();

    if (fetchError || !currentCalendar) {
      return NextResponse.json({ error: 'Academic calendar not found' }, { status: 404 });
    }

    let newYearId = currentCalendar.current_year_id;
    let newSemesterId = currentCalendar.current_semester_id;

    // Logic for semester progression
    if (currentCalendar.current_semester.semester_number === 1) {
      // Move from semester 1 to semester 2 of the same year
      const { data: nextSemester } = await supabaseAdmin
        .from('semesters')
        .select('id')
        .eq('year_id', currentCalendar.current_year_id)
        .eq('semester_number', 2)
        .maybeSingle();
      
      if (nextSemester) {
        newSemesterId = nextSemester.id;
      }
    } else {
      // Move from semester 2 to semester 1 of the next year
      const currentBatchYear = currentCalendar.current_year.batch_year;
      const { data: nextYear } = await supabaseAdmin
        .from('years')
        .select('id')
        .eq('batch_year', currentBatchYear + 1)
        .maybeSingle();
      
      if (nextYear) {
        newYearId = nextYear.id;
        const { data: nextSemester } = await supabaseAdmin
          .from('semesters')
          .select('id')
          .eq('year_id', nextYear.id)
          .eq('semester_number', 1)
          .maybeSingle();
        
        if (nextSemester) {
          newSemesterId = nextSemester.id;
        }
      } else {
        return NextResponse.json({ 
          error: 'Next academic year not found. Please create it first.' 
        }, { status: 400 });
      }
    }

    // Update academic calendar
    const { data, error } = await supabaseAdmin
      .from('academic_calendar')
      .update({
        current_year_id: newYearId,
        current_semester_id: newSemesterId,
        last_updated: new Date().toISOString(),
        updated_by: admin.email
      })
      .eq('id', currentCalendar.id)
      .select(`
        id,
        current_year_id,
        current_semester_id,
        last_updated,
        updated_by,
        current_year:years(id, batch_year, display_name),
        current_semester:semesters(id, semester_number)
      `)
      .single();

    if (error) {
      console.error('Semester progression error:', error);
      return NextResponse.json({ 
        error: 'Failed to progress semester',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      calendar: data,
      message: 'Semester progressed successfully'
    });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Semester progression API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
