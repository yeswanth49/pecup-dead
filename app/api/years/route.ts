// Years API Route
// Manages academic years/batches

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Year } from '@/lib/types';

export async function GET() {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('years')
      .select('*')
      .order('batch_year', { ascending: false });

    if (error) {
      console.error('Years fetch error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ years: data || [] });
  } catch (error) {
    console.error('Years API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Require admin access to create years
    await requireAdmin('admin');
    
    const supabaseAdmin = createSupabaseAdmin();
    
    const body = await request.json();
    const { batch_year, display_name } = body;

    if (!batch_year || !display_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: batch_year, display_name' 
      }, { status: 400 });
    }

    // Validate batch_year is a number
    const yearNum = parseInt(batch_year, 10);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return NextResponse.json({ 
        error: 'Invalid batch_year. Must be a number between 2020 and 2030' 
      }, { status: 400 });
    }

    // Use transaction-like approach: create year and semesters together
    // First, insert the new year
    const { data: yearData, error: yearError } = await supabaseAdmin
      .from('years')
      .insert({ batch_year: yearNum, display_name })
      .select('*')
      .single();

    if (yearError) {
      console.error('Year creation error:', yearError);
      
      // Handle uniqueness violations
      const isUniqueViolation = (yearError as any)?.code === '23505';
      const message = isUniqueViolation ? 'Batch year already exists' : 'Database error';
      
      return NextResponse.json({ 
        error: message,
        details: yearError.message 
      }, { status: 400 });
    }

    // Automatically create semesters for the new year
    const semesterInserts = [
      { semester_number: 1, year_id: yearData.id },
      { semester_number: 2, year_id: yearData.id }
    ];

    const { error: semesterError } = await supabaseAdmin
      .from('semesters')
      .insert(semesterInserts);

    if (semesterError) {
      console.error('Failed to create semesters for new year:', semesterError);
      
      // Rollback: delete the created year
      await supabaseAdmin
        .from('years')
        .delete()
        .eq('id', yearData.id);
      
      return NextResponse.json({ 
        error: 'Failed to create year and semesters' 
      }, { status: 500 });
    }

    // Return the created year with semesters
    const { data: completeYear, error: fetchError } = await supabaseAdmin
      .from('years')
      .select(`
        id,
        batch_year,
        display_name,
        created_at,
        semesters:semesters(id, semester_number)
      `)
      .eq('id', yearData.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ year: yearData }, { status: 201 });
    }

    return NextResponse.json({ year: completeYear }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Years API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
