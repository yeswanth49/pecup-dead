// app/api/prime-section-data/route.ts
// Logic: Finds the SOONEST date with upcoming exam(s) within the threshold
//        and fetches resources for ALL exams on that specific date.
// Version: Handles multiple exams on the next day, Reduced Logging
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// --- Configuration ---
const UPCOMING_EXAM_DAYS_THRESHOLD = 4; // Days from today to look ahead
const EXAM_SHEET_NAME = 'exams';
const EXAM_SHEET_RANGE = `${EXAM_SHEET_NAME}!A:B`;
const RESOURCE_SHEET_NAME = 'pecup';
const RESOURCE_SHEET_RANGE = `${RESOURCE_SHEET_NAME}!A:H`;

// --- Interfaces ---
interface Exam {
    subject: string;
    examDate: string; // YYYY-MM-DD format
}

interface RawResource {
    category: string;
    subject: string;
    groupingKey: string;
    title: string;
    description: string;
    url: string;
}

interface GroupedResourceItem {
    id: string | number;
    title: string;
    url: string;
}

interface GroupedResources {
    notes: Record<string, GroupedResourceItem[]>;
    assignments: Record<string, GroupedResourceItem[]>;
    papers: Record<string, GroupedResourceItem[]>;
}

interface PrimeDataResponse {
    data: GroupedResources | null;
    triggeringSubjects: string[]; // May contain multiple subjects if they share the soonest date
    error?: string;
}

// --- Helper Functions (getSheetsClient, isDateWithinDays - unchanged) ---

async function getSheetsClient() {
    // console.log("Helper: Attempting to get Google Sheets client...");
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    if (!email || !key) {
        console.error("Helper Error: Google Sheets API credentials missing.");
        throw new Error("Configuration Error: Google Sheets API credentials missing.");
    }
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: email,
                private_key: key.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheetsClient = google.sheets({ version: 'v4', auth: auth });
        if (typeof sheetsClient !== 'object' || sheetsClient === null) {
             console.error("Helper Error: google.sheets() did not return a valid object!");
             throw new Error("Internal Authentication Error: Failed to create sheets client.");
        }
        return sheetsClient;
    } catch (error) {
        console.error("Helper Error: Failed during Google auth/sheets client creation:", error);
        throw new Error(`Authentication Error: ${error.message || 'Failed to authenticate with Google Sheets API.'}`);
    }
}

const isDateWithinDays = (dateString: string | undefined, days: number): boolean => {
    if (!dateString) return false;
    try {
        const examDate = new Date(dateString + 'T00:00:00Z');
        if (isNaN(examDate.getTime())) return false;
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const futureDateLimit = new Date(today);
        futureDateLimit.setUTCDate(today.getUTCDate() + days + 1);
        return examDate >= today && examDate < futureDateLimit;
    } catch (e) {
        console.error("isDateWithinDays Helper Error: Error parsing date:", dateString, e);
        return false;
    }
};

const groupFilteredResources = (resources: RawResource[]): GroupedResources => {
    // (Unchanged from previous version)
    const grouped: GroupedResources = { notes: {}, assignments: {}, papers: {} };
    resources.forEach((item, index) => {
        const category = item.category?.trim().toLowerCase() || "unknown";
        const rawGroupKey = item.groupingKey?.trim() || "Uncategorized";
        let displayGroupKey = rawGroupKey;
        if ((category === "notes" || category === "assignments") && /^\d+$/.test(rawGroupKey)) {
             displayGroupKey = `unit ${rawGroupKey}`;
        }
        if (category === "notes" || category === "assignments" || category === "papers") {
            if (!grouped[category][displayGroupKey]) {
                grouped[category][displayGroupKey] = [];
            }
            grouped[category][displayGroupKey].push({
                id: `prime-res-${index}`,
                title: item.description || item.title || 'Untitled Resource',
                url: item.url,
            });
        }
    });
    return grouped;
};


// --- API Route Handler ---
export async function GET() {
    const startTime = Date.now();
    console.log(`API Route: /api/prime-section-data called at ${new Date().toISOString()} (Logic: ALL exams on the single SOONEST date)`); // Updated logic description
    console.log("API Route: Context Location: Kakinada, Andhra Pradesh, India"); // Location context

    try {
        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        if (!spreadsheetId) throw new Error("Configuration Error: Missing SPREADSHEET_ID env var.");

        // --- Fetch Exams ---
        const examResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: EXAM_SHEET_RANGE });
        const examRows = examResponse.data.values || [];

        // --- Filter for Upcoming Exams in Window ---
        let upcomingExamsData = examRows
            .slice(1)
            .map((row): Exam | null => {
                 if (!Array.isArray(row) || row.length < 2) return null;
                 const subject = row[0]?.trim()?.toLowerCase();
                 const examDateStr = row[1]?.trim();
                 if (!subject || !examDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(examDateStr)) {
                     return null;
                 }
                 return { subject, examDate: examDateStr };
            })
            .filter((exam): exam is Exam => {
                return exam !== null && isDateWithinDays(exam.examDate, UPCOMING_EXAM_DAYS_THRESHOLD);
           });

        console.log(`API Prime: Found ${upcomingExamsData.length} exams on or after today within the ${UPCOMING_EXAM_DAYS_THRESHOLD}-day window.`);

        // --- *** NEW LOGIC START: Select ALL exams on the SOONEST date *** ---
        let examsToDisplay: Exam[] = [];
        let uniqueUpcomingSubjects: string[] = [];

        if (upcomingExamsData.length > 0) {
            // Sort exams by date (ascending)
            upcomingExamsData.sort((a, b) => a.examDate.localeCompare(b.examDate));

            // Get the soonest date from the first exam in the sorted list
            const soonestDate = upcomingExamsData[0].examDate;

            // Filter the sorted list to include ALL exams on that soonest date
            examsToDisplay = upcomingExamsData.filter(exam => exam.examDate === soonestDate);

            // Get the subjects for all exams on that date
            uniqueUpcomingSubjects = examsToDisplay.map(exam => exam.subject);

            // Log the selected exams (could be one or more)
            console.log(`API Prime: Selected ALL exams for the soonest date '${soonestDate}': Subjects=[${uniqueUpcomingSubjects.join(', ')}]`);
        } else {
            console.log("API Prime: No upcoming exams found within the window.");
        }
        // --- *** NEW LOGIC END *** ---


        // --- If no exams found for the soonest date, return empty ---
        if (examsToDisplay.length === 0) { // Check the new array
            // console.log("API Prime: No exams identified for display. Returning empty data."); // Slightly redundant
            const responsePayload: PrimeDataResponse = { data: null, triggeringSubjects: [] };
            const endTime = Date.now();
            console.log(`API Prime: Returning empty payload (no upcoming exam found on soonest date). Execution time: ${endTime - startTime}ms`);
            return NextResponse.json(responsePayload);
        }

        // --- Fetch Resources ---
        const resourceResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: RESOURCE_SHEET_RANGE });
        const resourceRows = resourceResponse.data.values || [];

        // --- Filter Resources for ALL selected subjects ---
        // The existing filter logic works because uniqueUpcomingSubjects now contains all subjects for the soonest date
        const relevantResources: RawResource[] = resourceRows
            .slice(1)
            .map((row): RawResource | null => {
                 if (!Array.isArray(row) || row.length < 8) return null;
                 const res = {
                    category: row[0]?.trim(),
                    subject: row[1]?.trim()?.toLowerCase(),
                    groupingKey: row[2]?.trim(),
                    title: row[3]?.trim(),
                    description: row[4]?.trim(),
                    url: row[7]?.trim(),
                 };
                 if (!res.category || !res.subject || !res.groupingKey || !(res.description || res.title) || !res.url) {
                     return null;
                 }
                 return res;
            })
            .filter((res): res is RawResource => {
                // Filter out nulls and keep only if subject matches ANY of the selected subjects
                return res !== null && uniqueUpcomingSubjects.includes(res.subject);
            });

        console.log(`API Prime: Found ${relevantResources.length} relevant resources for subjects [${uniqueUpcomingSubjects.join(', ')}] after filtering.`);

        // --- Group the Filtered Resources ---
        const groupedData = groupFilteredResources(relevantResources);

        // --- Return Response ---
        const hasData = Object.values(groupedData).some(category => Object.keys(category).length > 0);
        const responsePayload: PrimeDataResponse = {
            data: hasData ? groupedData : null,
            triggeringSubjects: uniqueUpcomingSubjects // Send back the list of subjects (could be multiple)
        };
        const endTime = Date.now();
        console.log(`API Prime: Returning final payload for subjects [${uniqueUpcomingSubjects.join(', ')}]. Execution time: ${endTime - startTime}ms`);
        return NextResponse.json(responsePayload);

    } catch (error: any) {
        const endTime = Date.now();
        console.error(`API Error caught in GET /api/prime-section-data at ${new Date().toISOString()}. Execution time: ${endTime - startTime}ms`, error);
        if (error.stack) console.error("Stack Trace:", error.stack);
        return NextResponse.json({
             error: error.message || 'Failed to load prime section data',
             data: null,
             triggeringSubjects: []
        }, { status: 500 });
    }
}