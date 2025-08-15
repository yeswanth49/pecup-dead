// Updated Resources API Route for New Schema
// This file contains the updated implementation that works with the refactored database schema
// Replace the existing route.ts with this content after migration is complete

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Resource, ResourceFilters } from '@/lib/types';

const supabaseAdmin = createSupabaseAdmin();

export async function GET(request: Request) {
  console.log(`\nAPI Route: Received request at ${new Date().toISOString()}`);

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category')?.toLowerCase();
  const encodedSubject = searchParams.get('subject');
  const unit = searchParams.get('unit');
  let branch_id = searchParams.get('branch_id');
  let year_id = searchParams.get('year_id');
  let semester_id = searchParams.get('semester_id');
  
  // Legacy support - convert old branch/year/semester params to IDs
  const branch_code = searchParams.get('branch');
  const year_number = searchParams.get('year');
  const semester_number = searchParams.get('semester');

  console.log(`API Route: Query Params - category: ${category}, encodedSubject: ${encodedSubject}, unit: ${unit}`);

  // Parameter Validation
  if (!category || !encodedSubject || !unit) {
    console.warn("API Route: Missing required query parameters.");
    return NextResponse.json({ error: 'Missing required query parameters: category, subject, unit' }, { status: 400 });
  }

  let subject = '';
  try {
    // Enforce student profile filtering by default (RBAC)
    // If caller didn't provide branch/year/semester, infer from the logged-in user's student profile
    if (!branch_id || !year_id || !semester_id) {
      const session = await getServerSession(authOptions);
      const email = session?.user?.email?.toLowerCase();
      if (email) {
        const { data: student } = await supabaseAdmin
          .from('students')
          .select(`
            branch_id,
            year_id,
            semester_id,
            branch:branches(code),
            year:years(batch_year),
            semester:semesters(semester_number)
          `)
          .eq('email', email)
          .maybeSingle();
          
        if (student) {
          branch_id = branch_id || student.branch_id;
          year_id = year_id || student.year_id;
          semester_id = semester_id || student.semester_id;
        }
      }
    }
    
    // Legacy support: convert old branch/year/semester params to IDs
    if (!branch_id && branch_code) {
      const { data: branch } = await supabaseAdmin
        .from('branches')
        .select('id')
        .eq('code', branch_code)
        .maybeSingle();
      branch_id = branch?.id;
    }
    
    if (!year_id && year_number) {
      const yearNum = parseInt(year_number, 10);
      // Map old year numbers (1,2,3,4) to batch years (2024,2023,2022,2021)
      const batchYear = yearNum === 1 ? 2024 : yearNum === 2 ? 2023 : yearNum === 3 ? 2022 : yearNum === 4 ? 2021 : 2024;
      const { data: year } = await supabaseAdmin
        .from('years')
        .select('id')
        .eq('batch_year', batchYear)
        .maybeSingle();
      year_id = year?.id;
    }
    
    if (!semester_id && semester_number && year_id) {
      const semNum = parseInt(semester_number, 10);
      const { data: semester } = await supabaseAdmin
        .from('semesters')
        .select('id')
        .eq('year_id', year_id)
        .eq('semester_number', semNum)
        .maybeSingle();
      semester_id = semester?.id;
    }

    subject = decodeURIComponent(encodedSubject);
    console.log(`API Route: Decoded subject: ${subject}`);
  } catch (error) {
    console.error(`API Route: Invalid subject parameter encoding: ${encodedSubject}`, error);
    return NextResponse.json({ error: 'Invalid subject parameter encoding' }, { status: 400 });
  }

  const unitNumber = parseInt(unit, 10);
  if (isNaN(unitNumber) || unitNumber <= 0) {
    console.warn(`API Route: Invalid unit number: ${unit}`);
    return NextResponse.json({ error: 'Invalid unit number' }, { status: 400 });
  }
  console.log(`API Route: Parsed unit number: ${unitNumber}`);

  try {
    console.log(`API Route: Querying Supabase for resources...`);
    
    // Query Supabase for resources with new schema and relationships
    let query = supabaseAdmin
      .from('resources')
      .select(`
        id,
        title,
        description,
        drive_link,
        file_type,
        branch_id,
        year_id,
        semester_id,
        uploader_id,
        created_at,
        category,
        subject,
        unit,
        date,
        is_pdf,
        branch:branches(id, name, code),
        year:years(id, batch_year, display_name),
        semester:semesters(id, semester_number),
        uploader:students(id, name, roll_number)
      `)
      .eq('category', category)
      .eq('subject', subject.toLowerCase())
      .eq('unit', unitNumber)
      .order('created_at', { ascending: false });

    // Apply filters based on new schema
    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }
    if (year_id) {
      query = query.eq('year_id', year_id);
    }
    if (semester_id) {
      query = query.eq('semester_id', semester_id);
    }

    const { data: resources, error } = await query;

    if (error) {
      console.error('API Error: Supabase query failed:', error);
      return NextResponse.json({ error: 'Failed to load resources from database' }, { status: 500 });
    }

    console.log(`API Route: Found ${resources?.length || 0} matching resources`);

    // Transform the data to match both new and legacy expected formats
    const transformedResources: Resource[] = (resources || []).map(resource => ({
      id: resource.id,
      title: resource.title,
      description: resource.description || '',
      drive_link: resource.drive_link,
      file_type: resource.file_type,
      branch_id: resource.branch_id,
      year_id: resource.year_id,
      semester_id: resource.semester_id,
      uploader_id: resource.uploader_id,
      created_at: resource.created_at,
      // Legacy fields for backward compatibility
      category: resource.category,
      subject: resource.subject,
      unit: resource.unit,
      name: resource.title, // Map new title to old name
      date: resource.date || resource.created_at,
      type: resource.file_type,
      url: resource.drive_link,
      is_pdf: resource.is_pdf,
      // Include relationship data
      branch: resource.branch,
      year: resource.year,
      semester: resource.semester,
      uploader: resource.uploader
    }));

    console.log(`API Route: Returning ${transformedResources.length} resources`);
    return NextResponse.json(transformedResources);

  } catch (error: any) {
    console.error('API Error during Supabase query:', error);
    return NextResponse.json({ error: 'Failed to load resources from database' }, { status: 500 });
  }
}
