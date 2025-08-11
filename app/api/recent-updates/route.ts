// app/api/recent-updates/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
const supabaseAdmin = createSupabaseAdmin();

// Define the structure for a recent update item
interface RecentUpdate {
    id: string;
    title: string;
    date: string;
    description?: string;
}

export async function GET() {
    try {
        console.log(`API Route: /api/recent-updates called at ${new Date().toISOString()}`);
        
        // Query Supabase for recent updates
        const { data: updates, error } = await supabaseAdmin
            .from('recent_updates')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10); // Limit to 10 most recent updates

        if (error) {
            console.error('API Error: Supabase query failed:', error);
            return NextResponse.json({ error: 'Failed to load recent updates from database' }, { status: 500 });
        }

        console.log(`API Route: Found ${updates?.length || 0} recent updates`);

        // Transform the data to match the expected format
        const recentUpdates: RecentUpdate[] = (updates || []).map(update => ({
            id: update.id,
            title: update.title || 'No Title',
            date: update.date || '',
            description: update.description || undefined
        }));

        console.log(`API Route: Returning ${recentUpdates.length} recent updates`);
        return NextResponse.json(recentUpdates);

    } catch (error: any) {
        console.error("API Error during Supabase query:", error);
        return NextResponse.json({ error: "Failed to fetch recent updates from database." }, { status: 500 });
    }
}