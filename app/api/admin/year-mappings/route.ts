import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
import { academicConfig } from '@/lib/academic-config';

/**
 * GET - View current year mappings
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, role')
    .eq('email', email)
    .single();

  if (!profile?.is_superadmin && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const mappings = await academicConfig.getYearMappings();

    // Get student distribution
    const { data: students } = await supabase
      .from('profiles')
      .select('year')
      .eq('role', 'student');

    const distribution: Record<number, number> = {};
    for (const student of students || []) {
      const academicYear = mappings[student.year] || 4;
      distribution[academicYear] = (distribution[academicYear] || 0) + 1;
    }

    return NextResponse.json({
      current_mappings: mappings,
      student_distribution: distribution,
      total_students: students?.length || 0,
      explanation: {
        "2025": "Students who joined in 2025",
        "2024": "Students who joined in 2024",
        "2023": "Students who joined in 2023",
        "2022": "Students who joined in 2022"
      }
    });
  } catch (error) {
    console.error('Error fetching year mappings:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST - Promote all students (shift mappings by +1)
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, role')
    .eq('email', email)
    .single();

  if (!profile?.is_superadmin && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const oldMappings = await academicConfig.getYearMappings();
    await academicConfig.promoteAllStudents();
    const newMappings = await academicConfig.getYearMappings();

    return NextResponse.json({
      success: true,
      message: 'All students promoted successfully',
      old_mappings: oldMappings,
      new_mappings: newMappings,
      changes: Object.keys(oldMappings).map(key => {
        const year = parseInt(key);
        return {
          batch_year: year,
          old_academic_year: oldMappings[year],
          new_academic_year: newMappings[year]
        };
      })
    });
  } catch (error) {
    console.error('Error promoting students:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH - Demote all students (shift mappings by -1)
 */
export async function PATCH() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, role')
    .eq('email', email)
    .single();

  if (!profile?.is_superadmin && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const oldMappings = await academicConfig.getYearMappings();
    await academicConfig.demoteAllStudents();
    const newMappings = await academicConfig.getYearMappings();

    return NextResponse.json({
      success: true,
      message: 'All students demoted successfully',
      old_mappings: oldMappings,
      new_mappings: newMappings,
      changes: Object.keys(oldMappings).map(key => {
        const year = parseInt(key);
        return {
          batch_year: year,
          old_academic_year: oldMappings[year],
          new_academic_year: newMappings[year]
        };
      })
    });
  } catch (error) {
    console.error('Error demoting students:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PUT - Manually set year mappings
 */
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, role')
    .eq('email', email)
    .single();

  if (!profile?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden - Superadmin only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { mappings } = body;

    if (!mappings || typeof mappings !== 'object') {
      return NextResponse.json({ error: 'Invalid mappings format' }, { status: 400 });
    }

    await academicConfig.updateYearMappings(mappings);

    return NextResponse.json({
      success: true,
      message: 'Year mappings updated successfully',
      new_mappings: mappings
    });
  } catch (error) {
    console.error('Error updating year mappings:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}