// Updated Resources API Route for New Schema
// This file contains the updated implementation that works with the resources table directly
// Modified to support fetching resources from all units when no unit parameter is specified

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Resource, ResourceFilters } from '@/lib/types';
import { academicConfig } from '@/lib/academic-config';

export async function GET(request: Request) {
  console.log(`\nAPI Route: Received request at ${new Date().toISOString()}`);

  const supabaseAdmin = createSupabaseAdmin();
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
  if (!category || !encodedSubject) {
    console.warn("API Route: Missing required query parameters.");
    return NextResponse.json({ error: 'Missing required query parameters: category, subject' }, { status: 400 });
  }

  let subject = '';
  try {
    // Enforce student profile filtering by default (RBAC)
    // If caller didn't provide branch/year/semester, infer from the logged-in user's student profile
    if (!branch_id || !year_id || !semester_id) {
      const session = await getServerSession(authOptions);
      const email = session?.user?.email?.toLowerCase();
      if (email) {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('branch_id, year_id, semester_id')
          .eq('email', email)
          .maybeSingle();

        if (prof) {
          branch_id = branch_id || (prof as any).branch_id;
          year_id = year_id || (prof as any).year_id;
          semester_id = semester_id || (prof as any).semester_id;
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

      // Validate year number is within expected bounds
      if (yearNum < 1 || yearNum > 4) {
        console.warn(`Invalid year number: ${yearNum}. Expected 1-4.`);
        return NextResponse.json({ error: 'Invalid year number. Expected 1-4.' }, { status: 400 });
      }

      // Map old year numbers (1,2,3,4) to batch years based on current academic progression
      // This should match the academic config mappings
      const yearToBatchMapping: Record<number, number> = {
        1: 2024, // Year 1 -> 2024 batch (no 2025 batch in DB, use most recent)
        2: 2024, // Year 2 -> 2024 batch (2024 batch is currently Year 2)
        3: 2023, // Year 3 -> 2023 batch (2023 batch is currently Year 3)
        4: 2022  // Year 4 -> 2022 batch (2022 batch is currently Year 4)
      };
      const batchYear = yearToBatchMapping[yearNum] || 2024;

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

    subject = decodeURIComponent(encodedSubject).trim().toLowerCase();
    console.log(`API Route: Decoded and normalized subject: ${subject}`);
  } catch (error) {
    console.error(`API Route: Invalid subject parameter encoding: ${encodedSubject}`, error);
    return NextResponse.json({ error: 'Invalid subject parameter encoding' }, { status: 400 });
  }

  let unitNumber: number | null = null;
  if (unit) {
    unitNumber = parseInt(unit, 10);
    if (isNaN(unitNumber) || unitNumber <= 0) {
      console.warn(`API Route: Invalid unit number: ${unit}`);
      return NextResponse.json({ error: 'Invalid unit number' }, { status: 400 });
    }
    console.log(`API Route: Parsed unit number: ${unitNumber}`);
  } else {
    console.log(`API Route: No unit specified, fetching from all units`);
  }

  try {
    console.log(`API Route: Querying Supabase for resources...`);

    // Query Supabase for resources with new schema and relationships
    let query = supabaseAdmin
      .from('resources')
      .select(`
        id,
        name,
        description,
        drive_link,
        url,
        type,
        branch_id,
        year_id,
        semester_id,
        created_by,
        created_at,
        category,
        subject,
        unit,
        date,
        is_pdf,
        branch:branches(id, name, code),
        year:years(id, batch_year, display_name),
        semester:semesters(id, semester_number)
      `)
      .eq('category', category)
      .eq('subject', subject)
      .order('unit', { ascending: true })
      .order('created_at', { ascending: false });

   // Apply unit filter only if specified
   if (unitNumber !== null) {
     query = query.eq('unit', unitNumber);
   }

    // Get user's branch and year info for common subject checking
    let userBranchCode = '';
    let userAcademicYear = 1;

    if (branch_id) {
      const { data: branchData } = await supabaseAdmin
        .from('branches')
        .select('code')
        .eq('id', branch_id)
        .maybeSingle();
      userBranchCode = branchData?.code || '';
    }

    if (year_id) {
      const { data: yearData } = await supabaseAdmin
        .from('years')
        .select('batch_year')
        .eq('id', year_id)
        .maybeSingle();
      if (yearData?.batch_year) {
        userAcademicYear = await academicConfig.calculateAcademicYear(yearData.batch_year);
      }
    }

    // Check if this is a common subject for the user's branch/year
    const isCommonSubject = academicConfig.isCommonSubject(subject.toUpperCase(), userAcademicYear, userBranchCode);

    // Apply filters based on new schema
    if (isCommonSubject) {
      // For common subjects, allow access to resources from all allowed branches
      const allowedBranches = academicConfig.getCommonSubjectBranches(subject.toUpperCase(), userAcademicYear);
      if (allowedBranches.length > 0) {
        // Get branch IDs for allowed branches
        const { data: allowedBranchData } = await supabaseAdmin
          .from('branches')
          .select('id')
          .in('code', allowedBranches);

        const allowedBranchIds = allowedBranchData?.map(b => b.id) || [];
        if (allowedBranchIds.length > 0) {
          query = query.in('branch_id', allowedBranchIds);
        }
      }
    } else if (branch_id) {
      // For regular subjects, only show user's branch resources
      query = query.eq('branch_id', branch_id);
    }

    if (year_id) {
       query = query.eq('year_id', year_id);
    }
    if (semester_id) {
        query = query.or(`semester_id.eq.${semester_id},semester_id.is.null`);
     }

    console.log(`API Route: Applied filters - branch_id: ${branch_id}, year_id: ${year_id}, semester_id: ${semester_id}, unit: ${unitNumber}`);

    const { data: resources, error } = await query;

    if (error) {
      console.error('API Error: Supabase query failed:', error);
      return NextResponse.json({ error: 'Failed to load resources from database' }, { status: 500 });
    }

    console.log(`API Route: Found ${resources?.length || 0} matching resources`);
    console.log(`API Route: Raw resources data (first 2 items for debug):`, resources?.slice(0, 2));

    // Transform the data to match both new and legacy expected formats
    const transformedResources = (resources || []).map(resource => ({
       id: resource.id,
       name: resource.name,
       title: resource.name, // Keep both for compatibility
       description: resource.description || '',
       drive_link: resource.drive_link,
       url: resource.url,
       file_type: resource.type,
       type: resource.type,
       branch_id: resource.branch_id,
       year_id: resource.year_id,
       semester_id: resource.semester_id,
       uploader_id: resource.created_by,
       created_at: resource.created_at,
       // Legacy fields for backward compatibility
       category: resource.category,
       subject: resource.subject,
       unit: resource.unit,
       date: resource.date || resource.created_at,
       is_pdf: resource.is_pdf,
       // Include relationship data (now single objects)
       branch: Array.isArray(resource.branch) ? resource.branch[0] : resource.branch,
       year: Array.isArray(resource.year) ? resource.year[0] : resource.year,
       semester: Array.isArray(resource.semester) ? resource.semester[0] : resource.semester
     }));

    console.log(`API Route: Returning ${transformedResources.length} resources`);
    console.log(`API Route: Transformed resources sample (first 2 for debug):`, transformedResources.slice(0, 2));
    return NextResponse.json(transformedResources as unknown as Resource[]);

  } catch (error: any) {
    console.error('API Error during Supabase query:', error);
    return NextResponse.json({ error: 'Failed to load resources from database' }, { status: 500 });
  }
}
