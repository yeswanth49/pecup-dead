// app/page.tsx (or wherever your Home component is)
'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react" // Import useState
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert for errors
import Link from "next/link"
import { BookOpen, Bell, Archive, Phone, AlertCircle, Loader2 } from "lucide-react" // Import icons for loading/error

// Define the structure for a recent update item (should match your API response)
interface RecentUpdate {
  id: string | number; // Unique identifier for the key prop
  title: string;
  date: string; // Or Date object, depending on your API
  description?: string; // Optional description
}

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // --- State for Recent Updates ---
  const [updates, setUpdates] = useState<RecentUpdate[]>([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(true);
  const [updatesError, setUpdatesError] = useState<string | null>(null);

  // --- Effect to redirect if not logged in ---
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  // --- Effect to fetch recent updates ---
  useEffect(() => {
    // Only fetch if the user is authenticated or session check is done
    if (sessionStatus === "authenticated") {
      const fetchUpdates = async () => {
        setIsLoadingUpdates(true);
        setUpdatesError(null);
        try {
          // Fetch from your *internal* API route
          const response = await fetch('/api/recent-updates'); // Adjust if your route is different
          if (!response.ok) {
            throw new Error(`Failed to fetch updates. Status: ${response.status}`);
          }
          const data = await response.json();

          // Basic validation (adapt based on your actual API response)
          if (Array.isArray(data)) {
             setUpdates(data as RecentUpdate[]); // Assuming API returns RecentUpdate[]
          } else {
             throw new Error("Invalid data format received for updates.");
          }

        } catch (error: any) {
          console.error("Error fetching recent updates:", error);
          setUpdatesError(error.message || "An error occurred while loading updates.");
          setUpdates([]); // Clear updates on error
        } finally {
          setIsLoadingUpdates(false);
        }
      };

      fetchUpdates();
    } else if (sessionStatus === 'unauthenticated') {
        // Handle case where user gets logged out while on the page - optional
        setIsLoadingUpdates(false); // Stop loading if unauthenticated
    }
    // Re-run if session status changes (e.g., after login)
  }, [sessionStatus]);

  // --- Render loading state for the whole page ---
  if (sessionStatus === "loading") {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // --- Render authenticated user's dashboard ---
  // Note: If sessionStatus is 'unauthenticated', this won't render due to the redirect effect
  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8"> {/* Add some padding */}
      <h1 className="text-2xl md:text-3xl pt-6 md:pt-10 font-bold">Welcome, {session?.user?.name || 'User'}</h1>

      <div className="space-y-2">
        {/* Removed duplicate H1 title */}
        <p className="text-muted-foreground">Your central location for all educational resources and information</p>
      </div>

      {/* --- Navigation Cards --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         {/* Card Links (kept as is) */}
         <Link href="/reminders" className="block">
           <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-lg font-medium">Reminders</CardTitle>
               <Bell className="h-5 w-5 text-primary" />
             </CardHeader>
             <CardContent>
               <CardDescription>Important deadlines and announcements</CardDescription>
             </CardContent>
           </Card>
         </Link>

         <Link href="/resources" className="block">
          <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Resources</CardTitle>
              <BookOpen className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>Access notes, assignments, papers, and records</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/archive" className="block">
           <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Archive</CardTitle>
              <Archive className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>Previous semester materials and resources</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/contact" className="block">
          <Card className="h-full transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Contact</CardTitle>
              <Phone className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>Get in touch with administration</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* --- Recent Updates Section (Now Dynamic) --- */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription>Latest changes to the resource hub</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Loading State */}
            {isLoadingUpdates && (
              <div className="flex items-center justify-center p-4">
                 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                 <span className="ml-2 text-muted-foreground">Loading updates...</span>
              </div>
            )}

            {/* Error State */}
            {updatesError && !isLoadingUpdates && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Updates</AlertTitle>
                <AlertDescription>{updatesError}</AlertDescription>
              </Alert>
            )}

            {/* Success State - Display Updates */}
            {!isLoadingUpdates && !updatesError && updates.length > 0 && (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div key={update.id} className="border-l-4 border-primary pl-4 transition-colors hover:bg-muted/50 py-1"> {/* Added hover effect */}
                    <h3 className="font-medium">{update.title}</h3>
                     {/* Format date nicely if needed */}
                    <p className="text-sm text-muted-foreground">{update.date}</p>
                    {update.description && <p className="text-sm text-muted-foreground mt-1">{update.description}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* No Updates Found State */}
            {!isLoadingUpdates && !updatesError && updates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent updates found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}