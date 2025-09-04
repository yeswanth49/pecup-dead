import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { academicConfig } from '@/lib/academic-config';

interface MappingRequest {
  branchCode: string;
  yearNumber: number;
  semesterNumber?: number;
}

interface MappingResponse {
  branch_id: string;
  year_id: string;
  semester_id: string;
}

export async function POST(request: Request) {
  let body: MappingRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { branchCode, yearNumber, semesterNumber = 1 } = body;

  if (!branchCode || typeof branchCode !== 'string') {
    return NextResponse.json({ error: 'Branch code is required and must be a string' }, { status: 400 });
  }

  if (!yearNumber || typeof yearNumber !== 'number') {
    return NextResponse.json({ error: 'Year number is required and must be a number' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  try {
    // Handle year mapping - if it's an academic year (1-4), convert to batch year
    let batchYear: number;
    if (yearNumber >= 1 && yearNumber <= 4) {
      // Convert academic year to batch year
      // Academic year 1 = current batch, year 2 = previous batch, etc.
      const currentBatchYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // If we're before July (academic year start), we're still in previous batch
      const adjustedYear = currentMonth >= 7 ? currentBatchYear : currentBatchYear - 1;

      // Calculate the batch year, but cap it at the most recent year in database
      const calculatedBatchYear = adjustedYear - (yearNumber - 1);
      batchYear = Math.min(calculatedBatchYear, 2024); // Cap at most recent year in database
    } else {
      // Assume it's already a batch year
      batchYear = yearNumber;
    }

    // Get branch ID
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('code', branchCode)
      .single();

    if (branchError || !branch) {
      return NextResponse.json({ error: `Invalid branch code: ${branchCode}` }, { status: 400 });
    }

    // Get year ID
    const { data: year, error: yearError } = await supabase
      .from('years')
      .select('id')
      .eq('batch_year', batchYear)
      .single();

    if (yearError || !year) {
      return NextResponse.json({ error: `Invalid year: ${batchYear}` }, { status: 400 });
    }

    // Get semester ID
    const { data: semester, error: semesterError } = await supabase
      .from('semesters')
      .select('id')
      .eq('year_id', year.id)
      .eq('semester_number', semesterNumber)
      .single();

    if (semesterError || !semester) {
      return NextResponse.json({ error: `Invalid semester: ${semesterNumber} for year ${batchYear}` }, { status: 400 });
    }

    const response: MappingResponse = {
      branch_id: branch.id,
      year_id: year.id,
      semester_id: semester.id
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Mapping error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
