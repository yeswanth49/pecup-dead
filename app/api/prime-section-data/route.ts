// app/api/prime-section-data/route.ts
// Logic: Finds the SOONEST date with upcoming exam(s) within the threshold
//        and fetches resources for ALL exams on that specific date.
// Version: Handles multiple exams on the next day, Reduced Logging
import { NextResponse } from 'next/server';
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
    name: string;
    description: string;
    date: string;
    type: string;
    url: string;
}

interface PrimeSectionData {
    upcomingExams: Exam[];
    resources: Resource[];
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

export async function GET() {
    const startTime = Date.now();
    console.log(`API Route: /api/prime-section-data called at ${new Date().toISOString()}`);
    
    try {
        // Compute date range [today .. today + threshold] as YYYY-MM-DD (UTC, timezone-independent)
        const startUtc = new Date();
        startUtc.setUTCHours(0, 0, 0, 0);
        const endUtc = new Date(startUtc);
        endUtc.setUTCDate(endUtc.getUTCDate() + UPCOMING_EXAM_DAYS_THRESHOLD);

        const startDateStr = startUtc.toISOString().slice(0, 10);
        const endDateStr = endUtc.toISOString().slice(0, 10);

        // Fetch upcoming exams from Supabase (DB-side filtering and selecting only needed columns)
        const { data: examData, error: examError } = await supabaseAdmin
            .from('exams')
            .select('subject, exam_date')
            .gte('exam_date', startDateStr)
            .lte('exam_date', endDateStr)
            .order('exam_date', { ascending: true });

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

        // Select ALL exams on the SOONEST date
        let examsToDisplay: Exam[] = [];
        let uniqueUpcomingSubjects: string[] = [];

        if (upcomingExamsData.length > 0) {
            // Find the earliest exam date
            const earliestDate = upcomingExamsData[0].examDate;
            
            // Get all exams on that earliest date
            examsToDisplay = upcomingExamsData.filter(exam => exam.examDate === earliestDate);
            uniqueUpcomingSubjects = Array.from(new Set(examsToDisplay.map(exam => exam.subject))).filter(Boolean);
            
            console.log(`API Prime: Selected ${examsToDisplay.length} exams on the soonest date (${earliestDate}): ${uniqueUpcomingSubjects.join(', ')}`);
        }

        // Fetch resources for the upcoming exam subjects
        let relevantResources: Resource[] = [];
        
        if (uniqueUpcomingSubjects.length > 0) {
            const { data: resourceData, error: resourceError } = await supabaseAdmin
                .from('resources')
                .select('*')
                .in('subject', uniqueUpcomingSubjects)
                .order('date', { ascending: false });

            if (resourceError) {
                console.error('API Error: Failed to fetch resources:', resourceError);
                // Don't fail the entire request, just return empty resources
                relevantResources = [];
            } else {
                relevantResources = (resourceData || []).map(resource => ({
                    name: resource.name || '',
                    description: resource.description || '',
                    date: resource.date || '',
                    type: resource.type || '',
                    url: resource.url || ''
                }));
            }
        }

        console.log(`API Prime: Found ${relevantResources.length} relevant resources for subjects: ${uniqueUpcomingSubjects.join(', ')}`);

        const responseData: PrimeSectionData = {
            upcomingExams: examsToDisplay,
            resources: relevantResources
        };

        const endTime = Date.now();
        console.log(`API Prime: Request completed in ${endTime - startTime}ms`);
        
        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('API Error during prime section data fetch:', error);
        return NextResponse.json({ error: 'Failed to load prime section data' }, { status: 500 });
    }
}