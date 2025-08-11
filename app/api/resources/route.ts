import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
const supabaseAdmin = createSupabaseAdmin();

// Define the Resource interface
interface Resource {
  id: string;
  category: string;
  subject: string;
  unit: number;
  name: string;
  description: string;
  date: string;
  type: string;
  url: string;
  is_pdf: boolean;
}

export async function GET(request: Request) {
  console.log(`\nAPI Route: Received request at ${new Date().toISOString()}`);

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category')?.toLowerCase();
  const encodedSubject = searchParams.get('subject');
  const unit = searchParams.get('unit');
  let year = searchParams.get('year');
  const semester = searchParams.get('semester');
  let branch = searchParams.get('branch');

  console.log(`API Route: Query Params - category: ${category}, encodedSubject: ${encodedSubject}, unit: ${unit}`);

  // Parameter Validation
  if (!category || !encodedSubject || !unit) {
    console.warn("API Route: Missing required query parameters.");
    return NextResponse.json({ error: 'Missing required query parameters: category, subject, unit' }, { status: 400 });
  }

  let subject = '';
  try {
    // Enforce student profile filtering by default (RBAC)
    // If caller didn't provide year/branch, infer from the logged-in user's profile
    if (!year || !branch) {
      const session = await getServerSession(authOptions);
      const email = session?.user?.email?.toLowerCase();
      if (email) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('year,branch')
          .eq('email', email)
          .maybeSingle();
        if (profile) {
          year = year || String(profile.year);
          branch = branch || String(profile.branch);
        }
      }
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
    
    // Query Supabase for resources matching the criteria
    let query = supabaseAdmin
      .from('resources')
      .select('*')
      .eq('category', category)
      .eq('subject', subject.toLowerCase())
      .eq('unit', unitNumber)
      .order('date', { ascending: false });

    const yearNum = year ? parseInt(year, 10) : NaN;
    if (!Number.isNaN(yearNum)) {
      query = query.eq('year', yearNum);
    }
    const semNum = semester ? parseInt(semester, 10) : NaN;
    if (!Number.isNaN(semNum)) {
      query = query.eq('semester', semNum);
    }

    if (branch) {
      query = query.eq('branch', branch);
    }

    const { data: resources, error } = await query;

    if (error) {
      console.error('API Error: Supabase query failed:', error);
      return NextResponse.json({ error: 'Failed to load resources from database' }, { status: 500 });
    }

    console.log(`API Route: Found ${resources?.length || 0} matching resources`);

    // Transform the data to match the expected format
    const filteredResources: Resource[] = (resources || []).map(resource => ({
      id: resource.id,
      category: resource.category,
      subject: resource.subject,
      unit: resource.unit,
      name: resource.name,
      description: resource.description || '',
      date: resource.date,
      type: resource.type,
      url: resource.url,
      is_pdf: resource.is_pdf
    }));

    console.log(`API Route: Returning ${filteredResources.length} resources`);
    return NextResponse.json(filteredResources);

  } catch (error: any) {
    console.error('API Error during Supabase query:', error);
    return NextResponse.json({ error: 'Failed to load resources from database' }, { status: 500 });
  }
}