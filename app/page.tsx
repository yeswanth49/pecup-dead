// app/page.tsx (Consistent with Exam-Triggered Prime Section)
'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react" // Removed useMemo as grouping is now server-side
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link"
import { BookOpen, Bell, Archive, Phone, AlertCircle, Loader2, Star, ExternalLink, FileText, Edit, FileQuestion } from "lucide-react"

// --- Data Structures ---
interface RecentUpdate {
  id: string | number;
  title: string;
  date: string;
  description?: string;
}

// Structures matching the response from /api/prime-section-data
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
// Structure of the entire API response object
interface PrimeDataResponse {
    data: GroupedResources | null; // data is null if no upcoming exams
    triggeringSubjects: string[];
}


export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // --- State Variables ---
  const [updates, setUpdates] = useState<RecentUpdate[]>([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(true);
  const [updatesError, setUpdatesError] = useState<string | null>(null);

  // State for Prime Section Data (from /api/prime-section-data)
  const [primeData, setPrimeData] = useState<PrimeDataResponse | null>(null);
  const [isLoadingPrime, setIsLoadingPrime] = useState(true);
  const [primeError, setPrimeError] = useState<string | null>(null);


  // --- Effect to redirect if not logged in ---
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  // --- Effect to fetch Updates and Prime Section Data ---
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      // Fetch Updates (same as before)
      const fetchUpdates = async () => {
         setIsLoadingUpdates(true); setUpdatesError(null);
         try {
            const response = await fetch('/api/recent-updates');
            if (!response.ok) throw new Error(`Updates fetch failed: ${response.status}`);
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("Invalid updates data format.");
            setUpdates(data);
         } catch (error: any) { console.error("Error fetching recent updates:", error); setUpdatesError(error.message || "Error.");
         } finally { setIsLoadingUpdates(false); }
      };

      // Fetch Prime Section Data (from the smart endpoint)
      const fetchPrimeSectionData = async () => {
        setIsLoadingPrime(true);
        setPrimeError(null);
        setPrimeData(null); // Reset previous data
        try {
            // Fetch from the '/api/prime-section-data' endpoint
            const response = await fetch('/api/prime-section-data'); // *** Use the correct route name ***
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(`Prime Section fetch failed: ${response.status} - ${errorBody?.error || 'Unknown error'}`);
            }
            const data: PrimeDataResponse = await response.json();
             // Validate the structure received from the API
            if (typeof data !== 'object' || data === null || !('data' in data) || !('triggeringSubjects' in data) || !Array.isArray(data.triggeringSubjects)) {
                throw new Error("Invalid prime section data format received from API.");
            }
            setPrimeData(data);
        } catch (error: any) {
            console.error("Error fetching prime section data:", error);
            setPrimeError(error.message || "An error occurred loading prime section data.");
        } finally {
            setIsLoadingPrime(false);
        }
      };

      fetchUpdates();
      fetchPrimeSectionData(); // Call the fetch function for prime data

    } else if (sessionStatus === 'unauthenticated') {
      setIsLoadingUpdates(false);
      setIsLoadingPrime(false); // Make sure prime loading stops too
    }
  }, [sessionStatus]); // Dependency array


  // --- Render loading state for the whole page (session check) ---
  if (sessionStatus === "loading") {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // --- Render authenticated user's dashboard ---
  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8">
        <Header/>

        {/* ... Top description and Navigation Cards ... (same as before) */}
         <div className="space-y-2">
             <p className="text-muted-foreground">Your central location for all educational resources and information</p>
         </div>
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             {/* Card Links */}
             <Link href="/reminders" className="block"><Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-lg font-medium">Reminders</CardTitle><Bell className="h-5 w-5 text-primary" /></CardHeader><CardContent><CardDescription>Important deadlines and announcements</CardDescription></CardContent></Card></Link>
             <Link href="/resources" className="block"><Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-lg font-medium">Resources</CardTitle><BookOpen className="h-5 w-5 text-primary" /></CardHeader><CardContent><CardDescription>Access notes, assignments, papers, and records</CardDescription></CardContent></Card></Link>
             <Link href="/archive" className="block"><Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-lg font-medium">Archive</CardTitle><Archive className="h-5 w-5 text-primary" /></CardHeader><CardContent><CardDescription>Previous semester materials and resources</CardDescription></CardContent></Card></Link>
             <Link href="/contact" className="block"><Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-lg font-medium">Contact</CardTitle><Phone className="h-5 w-5 text-primary" /></CardHeader><CardContent><CardDescription>Get in touch with administration</CardDescription></CardContent></Card></Link>
         </div>


       {/* --- Dynamic Exam Prep Section --- */}
       {/* Show loading indicator */}
       {isLoadingPrime && (
           <div className="mt-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading Exam Prep Section...
           </div>
       )}
       {/* Show error */}
       {primeError && !isLoadingPrime && (
            <Alert variant="destructive" className="mt-8">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Exam Prep Section</AlertTitle>
                <AlertDescription>{primeError}</AlertDescription>
            </Alert>
       )}
       {/* Render section only if loading done, no error, AND API returned actual data (primeData.data is not null) */}
       {!isLoadingPrime && !primeError && primeData && primeData.data && (
        <div className="mt-8">
            <Card className="border-l-4 border-yellow-500 bg-yellow-50/30 dark:bg-yellow-900/10">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Star className="h-6 w-6 text-yellow-600" />
                        <CardTitle className="text-xl">Prime Section</CardTitle>
                    </div>
                     {/* Display which subjects triggered this */}
                    <CardDescription>
                        Showing key resources for upcoming exam(s) in: <span className="font-medium capitalize">{primeData.triggeringSubjects.join(', ')}</span>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Render the structured layout using primeData.data */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Notes Column */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-1 flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/> Notes</h3>
                            {primeData.data.notes && Object.keys(primeData.data.notes).length > 0 ? (
                                Object.entries(primeData.data.notes).map(([groupKey, items]) => (
                                    <div key={`notes-${groupKey}`}>
                                        <h4 className="font-medium mb-1">{groupKey}</h4>
                                        <ul className="space-y-1 list-none pl-2">
                                            {items.map(item => (
                                                <li key={item.id}>
                                                     <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1.5 group">
                                                        <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100"/>
                                                        {item.title}
                                                     </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground pl-2 italic">No relevant notes found.</p>
                            )}
                        </div>

                        {/* Assignments Column */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-1 flex items-center gap-2"><Edit className="h-5 w-5 text-primary"/> Assignments</h3>
                             {primeData.data.assignments && Object.keys(primeData.data.assignments).length > 0 ? (
                                Object.entries(primeData.data.assignments).map(([groupKey, items]) => (
                                    <div key={`assign-${groupKey}`}>
                                        <h4 className="font-medium mb-1">{groupKey}</h4>
                                        <ul className="space-y-1 list-none pl-2">
                                            {items.map(item => (
                                                <li key={item.id}>
                                                     <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1.5 group">
                                                         <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100"/>
                                                         {item.title}
                                                     </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            ) : (
                                 <p className="text-sm text-muted-foreground pl-2 italic">No relevant assignments found.</p>
                            )}
                        </div>

                        {/* Papers Column */}
                         <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-1 flex items-center gap-2"><FileQuestion className="h-5 w-5 text-primary"/> Papers</h3>
                              {primeData.data.papers && Object.keys(primeData.data.papers).length > 0 ? (
                                Object.entries(primeData.data.papers).map(([groupKey, items]) => (
                                    <div key={`paper-${groupKey}`}>
                                        <h4 className="font-medium mb-1">{groupKey}</h4>
                                        <ul className="space-y-1 list-none pl-2">
                                            {items.map(item => (
                                                <li key={item.id}>
                                                     <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1.5 group">
                                                         <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100"/>
                                                         {item.title}
                                                     </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            ) : (
                                 <p className="text-sm text-muted-foreground pl-2 italic">No relevant papers found.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
       )}
       {/* Optional: Message if loading is done but no upcoming exams triggered the section */}
       {/* This checks if the API call finished successfully but returned data: null */}
       {!isLoadingPrime && !primeError && primeData && !primeData.data && (
            <div className="mt-8 text-center text-muted-foreground italic text-sm">
                (No exams upcoming in the next few days)
            </div>
       )}


      {/* --- Recent Updates Section --- */}
      {/* (Remains unchanged from your provided code) */}
      <div className="mt-8">
          <Card>
              <CardHeader>
                  <CardTitle>Recent Updates</CardTitle>
                  <CardDescription>Latest changes to the resource hub</CardDescription>
              </CardHeader>
              <CardContent>
                  {/* Loading/Error/Display logic for Updates */}
                  {isLoadingUpdates && ( <div className="flex items-center justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> <span className="ml-2 text-muted-foreground">Loading updates...</span></div> )}
                  {updatesError && !isLoadingUpdates && ( <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /> <AlertTitle>Error Loading Updates</AlertTitle> <AlertDescription>{updatesError}</AlertDescription></Alert> )}
                  {!isLoadingUpdates && !updatesError && updates.length > 0 && ( <div className="space-y-4">{updates.map((update) => ( <div key={update.id} className="border-l-4 border-primary pl-4 transition-colors hover:bg-muted/50 py-1"><h3 className="font-medium">{update.title}</h3><p className="text-sm text-muted-foreground">{update.date}</p>{update.description && <p className="text-sm text-muted-foreground mt-1">{update.description}</p>}</div> ))}</div> )}
                  {!isLoadingUpdates && !updatesError && updates.length === 0 && ( <p className="text-sm text-muted-foreground text-center py-4">No recent updates found.</p> )}
              </CardContent>
          </Card>
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  );
}