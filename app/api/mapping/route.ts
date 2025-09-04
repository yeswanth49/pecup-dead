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
      // Map UI year selection to actual batch years based on current academic progression
      // This should match the academic config mappings
      const yearToBatchMapping: Record<number, number> = {
        1: 2024, // Year 1 -> 2024 batch (no 2025 batch in DB, use most recent)
        2: 2024, // Year 2 -> 2024 batch (2024 batch is currently Year 2)
        3: 2023, // Year 3 -> 2023 batch (2023 batch is currently Year 3)
        4: 2022  // Year 4 -> 2022 batch (2022 batch is currently Year 4)
      };

      batchYear = yearToBatchMapping[yearNumber] || 2024;
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
