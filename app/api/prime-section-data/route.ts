// app/api/prime-section-data/route.ts
// Logic: Finds the SOONEST date with upcoming exam(s) within the threshold
//        and fetches resources for ALL exams on that specific date.
// Version: Handles multiple exams on the next day, Reduced Logging
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseAdmin } from '@/lib/supabase';
const supabaseAdmin = createSupabaseAdmin();

// Configuration
const UPCOMING_EXAM_DAYS_THRESHOLD = 4; // Days from today to look ahead

// Interfaces
interface Exam {
    subject: string;
    examDate: string; // YYYY-MM-DD format
}

interface Resource {
    id?: string;
    name: string;
    description: string;
    date: string;
    type: string;
    category: string;
    url: string;
    subject?: string;
}

interface GroupedResourceItem {
    id: string;
    title: string;
    url: string;
    unitNumber: number;
}

interface GroupedResources {
    notes: Record<string, GroupedResourceItem[]>;
    assignments: Record<string, GroupedResourceItem[]>;
    papers: Record<string, GroupedResourceItem[]>;
}

interface PrimeSectionData {
    data: GroupedResources | null;
    triggeringSubjects: string[];
}

// Helper function to check if a date is within the specified threshold
function isDateWithinDays(dateString: string, daysThreshold: number): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0); // Start of target date
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 && diffDays <= daysThreshold;
}

export async function GET(request: Request) {
    const startTime = Date.now();
    console.log(`API Route: /api/prime-section-data called at ${new Date().toISOString()}`);
    
    try {
        // Set start date to today (no past exams)
        const startUtc = new Date();
        startUtc.setUTCHours(0, 0, 0, 0);
        const endUtc = new Date();
        endUtc.setUTCHours(0, 0, 0, 0);
        endUtc.setUTCDate(endUtc.getUTCDate() + UPCOMING_EXAM_DAYS_THRESHOLD);

        const startDateStr = startUtc.toISOString().slice(0, 10);
        const endDateStr = endUtc.toISOString().slice(0, 10);

        // Determine context from query or profile
        const url = new URL(request.url)
        let yearParam = url.searchParams.get('year')
        let branchParam = url.searchParams.get('branch')
        if (!yearParam || !branchParam) {
          const session = await getServerSession(authOptions)
          const email = session?.user?.email?.toLowerCase()
          if (email) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('year,branch')
              .eq('email', email)
              .maybeSingle()
            if (profile) {
              yearParam = yearParam || String(profile.year)
              branchParam = branchParam || String(profile.branch)
            }
          }
        }

        // Fetch upcoming exams from Supabase - get all exams since table doesn't have year/branch filtering yet
        const { data: examData, error: examError } = await supabaseAdmin
            .from('exams')
            .select('subject, exam_date')
            .gte('exam_date', startDateStr)
            .lte('exam_date', endDateStr)
            .order('exam_date', { ascending: true })

        if (examError) {
            console.error('API Error: Failed to fetch exams:', examError);
            return NextResponse.json({ error: 'Failed to load exam data' }, { status: 500 });
        }

        // Convert DB rows to response-friendly format (DB-side filtering makes client-side filtering unnecessary)
        const upcomingExamsData = (examData || [])
            .map(exam => ({
                subject: exam.subject || '',
                examDate: new Date(exam.exam_date).toISOString().split('T')[0]
            }));

        console.log(`API Prime: Found ${upcomingExamsData.length} exams within the ${UPCOMING_EXAM_DAYS_THRESHOLD}-day window.`);

        // Only show truly upcoming exams
        let examsToDisplay: Exam[] = upcomingExamsData;
        let uniqueUpcomingSubjects: string[] = Array.from(new Set(upcomingExamsData.map(exam => exam.subject))).filter(Boolean);

        if (upcomingExamsData.length > 0) {
            console.log(`API Prime: Found ${examsToDisplay.length} total exams for subjects: ${uniqueUpcomingSubjects.join(', ')}`);
        }

        // Fetch resources for the upcoming exam subjects
        let relevantResources: Resource[] = [];

        if (uniqueUpcomingSubjects.length > 0) {
            console.log(`API Prime: Querying resources with filters:`, {
                subjects: uniqueUpcomingSubjects,
                year: yearParam,
                branch: branchParam
            });

            // First try without year/branch filtering to see if resources exist
            const testQuery = supabaseAdmin
                .from('resources')
                .select('subject')
                .in('subject', uniqueUpcomingSubjects)
                .is('deleted_at', null);

            const { data: testData, error: testError } = await testQuery;
            console.log(`API Prime: Test query (no year/branch filter) found ${(testData || []).length} resources with error:`, testError);
            if (testData) {
                console.log(`API Prime: Test query subjects found:`, [...new Set(testData.map(r => r.subject))]);
            }

            // Resolve year_id and branch_id from yearParam and branchParam
            let yearId: string | null = null;
            let branchId: string | null = null;

            if (yearParam) {
                const yearNum = parseInt(yearParam, 10);
                const { data: yearData } = await supabaseAdmin
                    .from('years')
                    .select('id')
                    .eq('batch_year', yearNum)
                    .maybeSingle();
                yearId = yearData?.id || null;
                console.log(`API Prime: Resolved year ${yearNum} to year_id: ${yearId}`);
            }

            if (branchParam) {
                const { data: branchData } = await supabaseAdmin
                    .from('branches')
                    .select('id')
                    .eq('code', branchParam)
                    .maybeSingle();
                branchId = branchData?.id || null;
                console.log(`API Prime: Resolved branch ${branchParam} to branch_id: ${branchId}`);
            }

            // Query resources with proper UUID filters
            let resourceQuery = supabaseAdmin
              .from('resources')
              .select('id, name, description, date, type, category, url, subject')
              .is('deleted_at', null)
              .in('subject', uniqueUpcomingSubjects)
              .order('date', { ascending: false });

            // Apply UUID-based filters for year_id and branch_id
            if (yearId) {
                resourceQuery = resourceQuery.eq('year_id', yearId);
                console.log(`API Prime: Applying year_id filter: ${yearId}`);
            }
            if (branchId) {
                resourceQuery = resourceQuery.eq('branch_id', branchId);
                console.log(`API Prime: Applying branch_id filter: ${branchId}`);
            }

            console.log(`API Prime: Executing resource query with filters...`);
            const { data: resourceData, error: resourceError } = await resourceQuery

            console.log(`API Prime: Query result - data length: ${(resourceData || []).length}, error:`, resourceError);

            if (resourceError) {
                console.error('API Error: Failed to fetch resources:', resourceError);
                // Don't fail the entire request, just return empty resources
                relevantResources = [];
            } else {
                relevantResources = (resourceData || []).map(resource => ({
                    id: resource.id || '',
                    name: resource.name || '',
                    description: resource.description || '',
                    date: resource.date || '',
                    type: resource.type || '',
                    category: resource.category || '',
                    url: resource.url || '',
                    subject: resource.subject || '' // Add subject field
                }));
                console.log(`API Prime: Mapped ${relevantResources.length} resources`);
            }
        }

        console.log(`API Prime: Found ${relevantResources.length} relevant resources for subjects: ${uniqueUpcomingSubjects.join(', ')}`);
        console.log(`API Prime: Resource details:`, relevantResources.map(r => ({ name: r.name, subject: r.subject, type: r.type, category: r.category })));

        // Group resources by type
        const groupedResources: GroupedResources = {
            notes: {},
            assignments: {},
            papers: {}
        };

        relevantResources.forEach(resource => {
            // Use the resource's subject field directly, or try to match with exam subjects
            let subject = resource.subject || 'General';

            // If resource.subject is not in our exam subjects, try fuzzy matching
            if (!uniqueUpcomingSubjects.includes(subject)) {
                const matchedSubject = uniqueUpcomingSubjects.find(examSubj =>
                    subject.toLowerCase().includes(examSubj.toLowerCase()) ||
                    examSubj.toLowerCase().includes(subject.toLowerCase()) ||
                    resource.name.toLowerCase().includes(examSubj.toLowerCase()) ||
                    resource.description.toLowerCase().includes(examSubj.toLowerCase())
                );
                if (matchedSubject) {
                    subject = matchedSubject;
                }
            }

            // Capitalize subject names for better display
            subject = subject.toUpperCase();

            const resourceType = (resource.type || '').toLowerCase();
            const resourceCategory = (resource.category || '').toLowerCase();
            console.log(`API Prime: Processing resource "${resource.name}" with type "${resourceType}" category "${resourceCategory}" for subject "${subject}"`);

            // Extract unit number from title for sorting
            const title = resource.name || '';
            const unitMatch = title.match(/unit\s+(\d+)/i);
            const assignmentMatch = title.match(/assignment\s+(\d+)/i);
            const unitNumber = unitMatch ? parseInt(unitMatch[1], 10) :
                           assignmentMatch ? parseInt(assignmentMatch[1], 10) : 999;

            // Create the correctly formatted item for frontend
            const item: GroupedResourceItem & { unitNumber: number } = {
                id: String(resource.id),
                title: title,
                url: resource.url || '',
                unitNumber: unitNumber
            };

            // Determine grouping based on type first, then category if type is empty
            let groupType: keyof GroupedResources | null = null;

            if (resourceType.includes('note')) {
                groupType = 'notes';
            } else if (resourceType.includes('assignment')) {
                groupType = 'assignments';
            } else if (resourceType.includes('paper') || resourceType.includes('exam')) {
                groupType = 'papers';
            } else if (resourceCategory === 'assignments') {
                groupType = 'assignments';
            } else if (resourceCategory === 'papers' || resourceCategory === 'exam_papers') {
                groupType = 'papers';
            } else if (resourceCategory === 'notes') {
                groupType = 'notes';
            } else {
                // Default to notes for unknown types
                groupType = 'notes';
            }

            if (groupType) {
                if (!groupedResources[groupType][subject]) groupedResources[groupType][subject] = [];
                groupedResources[groupType][subject].push(item);
            }
        });

        // Sort each subject group by unit number
        Object.values(groupedResources.notes).forEach(subjectResources =>
            subjectResources.sort((a, b) => a.unitNumber - b.unitNumber));
        Object.values(groupedResources.assignments).forEach(subjectResources =>
            subjectResources.sort((a, b) => a.unitNumber - b.unitNumber));
        Object.values(groupedResources.papers).forEach(subjectResources =>
            subjectResources.sort((a, b) => a.unitNumber - b.unitNumber));

        console.log(`API Prime: Grouped resources:`, {
            notes: Object.keys(groupedResources.notes).length,
            assignments: Object.keys(groupedResources.assignments).length,
            papers: Object.keys(groupedResources.papers).length
        });

        const responseData: PrimeSectionData = {
            data: Object.keys(groupedResources.notes).length > 0 || 
                  Object.keys(groupedResources.assignments).length > 0 || 
                  Object.keys(groupedResources.papers).length > 0 ? groupedResources : null,
            triggeringSubjects: uniqueUpcomingSubjects
        };

        const endTime = Date.now();
        console.log(`API Prime: Request completed in ${endTime - startTime}ms`);
        
        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('API Error during prime section data fetch:', error);
        return NextResponse.json({ error: 'Failed to load prime section data' }, { status: 500 });
    }
}