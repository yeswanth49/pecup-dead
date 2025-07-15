// app/api/reminders/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
    console.log(`API Route (Reminders): Querying Supabase for reminders...`);
    
    // Query Supabase for all reminders, optionally filter by status
    const { data: reminders, error } = await supabaseAdmin
      .from('reminders')
      .select('*')
      .order('due_date', { ascending: true });

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