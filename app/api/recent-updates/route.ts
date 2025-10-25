// app/api/recent-updates/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Define the structure for a recent update item
interface RecentUpdate {
    id: string;
    title: string;
    date: string;
    description?: string;
}

export async function GET(request: Request) {
    const supabaseAdmin = createSupabaseAdmin();
    try {
        console.log(`API Route: /api/recent-updates called at ${new Date().toISOString()}`);
        const url = new URL(request.url)
        let year = url.searchParams.get('year')
        let branch = url.searchParams.get('branch')
        // Infer from profile if missing
        if (!year || !branch) {
          const session = await getServerSession(authOptions);
          
          if (!session?.user?.email) {
            console.warn('No session or email found for profile lookup');
          } else {
            const email = session.user.email.toLowerCase();
            
            try {
              const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('year,branch')
                .eq('email', email)
                .maybeSingle();
                
              if (profileError) {
                console.error('Profile lookup error:', profileError.message);
                return NextResponse.json({ error: 'Failed to load user profile' }, { status: 500 });
              }
              
              if (!profile) {
                console.warn(`No profile found for email: ${email}`);
              } else {
                year = year || (profile.year != null ? String(profile.year) : '');
                branch = branch || (profile.branch != null ? String(profile.branch) : '');
              }
            } catch (dbError) {
              console.error('Database error during profile lookup:', dbError instanceof Error ? dbError.message : 'Unknown error');
              return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }
          }
        }

        // Query Supabase for recent updates
        let query = supabaseAdmin
          .from('recent_updates')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        // If user has year and branch, filter by them, otherwise show all updates
        if (year && branch) {
          query = query
            .eq('year', parseInt(year, 10))
            .eq('branch', branch)
        }

        const updatesRes = await query
        if (updatesRes.error) {
          console.error('API Error: Supabase query failed:', updatesRes.error)
          return NextResponse.json({ error: 'Failed to load recent updates from database' }, { status: 500 })
        }
        const updates = updatesRes.data

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