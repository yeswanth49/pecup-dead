import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();

    // Count only from profiles (single source of truth for registered users)
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching profiles count:', error);
      return NextResponse.json({ error: 'Failed to fetch users count' }, { status: 500 });
    }

    const totalUsers = count || 0;

    return NextResponse.json({
      totalUsers,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Users count API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
