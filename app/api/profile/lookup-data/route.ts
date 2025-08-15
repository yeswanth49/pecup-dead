import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
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

  // Check for errors in each Supabase response
  if (branchesResult.error) {
    console.error('Failed to fetch branches:', branchesResult.error);
    return NextResponse.json({ 
      error: 'Failed to fetch branches', 
      details: branchesResult.error.message 
    }, { status: 500 });
  }

  if (yearsResult.error) {
    console.error('Failed to fetch years:', yearsResult.error);
    return NextResponse.json({ 
      error: 'Failed to fetch years', 
      details: yearsResult.error.message 
    }, { status: 500 });
  }

  if (semestersResult.error) {
    console.error('Failed to fetch semesters:', semestersResult.error);
    return NextResponse.json({ 
      error: 'Failed to fetch semesters', 
      details: semestersResult.error.message 
    }, { status: 500 });
  }

  // Check for missing data
  if (!branchesResult.data || !yearsResult.data || !semestersResult.data) {
    console.error('Missing lookup data:', {
      branches: !branchesResult.data,
      years: !yearsResult.data,
      semesters: !semestersResult.data
    });
    return NextResponse.json({ 
      error: 'Failed to retrieve complete lookup data' 
    }, { status: 500 });
  }

  return NextResponse.json({
    branches: branchesResult.data,
    years: yearsResult.data,
    semesters: semestersResult.data
  });
}
