// app/api/reminders/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
const supabaseAdmin = createSupabaseAdmin();

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
  console.log(`\nAPI Route (Reminders): Received request at ${new Date().toISOString()}`);

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim() || null;

    console.log(
      `API Route (Reminders): Querying Supabase for reminders${status ? ` with status=${status}` : ''}...`
    );

    // Build Supabase query: select only the fields that are returned and optionally filter by status
    let query = supabaseAdmin
      .from('reminders')
      .select('id,title,due_date,description,icon_type,status')
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

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