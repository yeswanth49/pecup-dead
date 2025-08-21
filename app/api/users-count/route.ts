import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    
    // Get counts from all user tables
    const [profilesResult, studentsResult, adminsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('students')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('admins')
        .select('id', { count: 'exact', head: true })
    ]);

    if (profilesResult.error || studentsResult.error || adminsResult.error) {
      console.error('Error fetching user counts:', {
        profiles: profilesResult.error,
        students: studentsResult.error,
        admins: adminsResult.error
      });
      return NextResponse.json({ error: 'Failed to fetch user counts' }, { status: 500 });
    }

    const profilesCount = profilesResult.count || 0;
    const studentsCount = studentsResult.count || 0;
    const adminsCount = adminsResult.count || 0;
    
    // Total users = profiles + students (avoiding double counting if users exist in both)
    // For now, we'll use profiles as the primary count since it's the main user table
    const totalUsers = profilesCount + studentsCount + adminsCount;

    return NextResponse.json({
      totalUsers,
      breakdown: {
        profiles: profilesCount,
        students: studentsCount,
        admins: adminsCount
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Users count API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
