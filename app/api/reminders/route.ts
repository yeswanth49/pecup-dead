// app/api/reminders/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';

// Define the structure for a reminder item
interface Reminder {
  id: string;
  title: string;
  due_date: string;
  description?: string;
  icon_type?: string;
  status?: string;
}

export async function GET(request: Request) {
  const supabaseAdmin = createSupabaseAdmin();
  console.log(`\nAPI Route (Reminders): Received request at ${new Date().toISOString()}`);

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim() || null;
    let year = searchParams.get('year');
    let branch = searchParams.get('branch');
    
    // Validate year parameter if provided
    if (year && !/^\d+$/.test(year)) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    console.log(
      `API Route (Reminders): Querying Supabase for reminders${status ? ` with status=${status}` : ''}...`
    );

    // Build Supabase query: select only the fields that are returned and optionally filter by status
    // Infer year/branch from profile if missing
    if (!year || !branch) {
      const session = await getServerSession(authOptions);
      if (session) {
        const email = session.user?.email?.toLowerCase();
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
    }

    let query = supabaseAdmin
      .from('reminders')
      .select('id,title,due_date,description,icon_type,status')
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (year) {
      const parsedYear = parseInt(year, 10);
      if (Number.isFinite(parsedYear)) {
        query = query.eq('year', parsedYear);
      }
    }
    if (branch) query = query.eq('branch', branch);

    const { data: reminders, error } = await query;

    if (error) {
      console.error('API Error (Reminders): Supabase query failed:', error);
      return NextResponse.json({ error: 'Failed to load reminders from database' }, { status: 500 });
    }

    console.log(`API Route (Reminders): Found ${reminders?.length || 0} reminders`);

    // Transform the data to match the expected format
    const activeReminders: Reminder[] = (reminders || []).map(reminder => ({
      id: reminder.id,
      title: reminder.title,
      due_date: reminder.due_date,
      description: reminder.description || '',
      icon_type: reminder.icon_type || '',
      status: reminder.status || ''
    }));

    console.log(`API Route (Reminders): Returning ${activeReminders.length} reminders`);
    return NextResponse.json(activeReminders);

  } catch (error: any) {
    console.error('API Error (Reminders) during Supabase query:', error);
    return NextResponse.json({ error: 'Failed to load reminders from database' }, { status: 500 });
  }
}