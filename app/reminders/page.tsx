// app/reminders/page.tsx (or wherever your reminders page is)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { CalendarClock, AlertCircle, Clock, Activity } from "lucide-react"; // Add Activity or another icon if needed

// Define the structure of a reminder item (should match API)
interface Reminder {
  title: string;
  dueDate: string;
  description: string;
  iconType?: string; // Optional: To control the icon
}

// Helper function to get the correct icon component
const getIcon = (iconType?: string): React.ReactElement => {
    const className = "mt-1 h-5 w-5 text-primary"; // Consistent styling
    switch (iconType?.toLowerCase()) {
        case 'alert':
            return <AlertCircle className={className} />;
        case 'clock':
            return <Clock className={className} />;
        case 'calendar':
            return <CalendarClock className={className} />;
        // Add more cases if you have other icon types
        default:
            return <Activity className={className} />; // Default icon if type is missing or unknown
    }
};


// Fetch data on the server
async function getReminders(): Promise<{ reminders: Reminder[]; error: string | null }> {
    let reminders: Reminder[] = [];
    let fetchError: string | null = null;

    try {
        // Construct Absolute URL for fetch in Server Components
        const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
        const apiUrl = new URL('/api/reminders', baseUrl);

        console.log(`RemindersPage: Fetching ${apiUrl.toString()}`);
        // Adjust cache strategy as needed:
        // 'no-store': Always fetch fresh data (good for frequent updates)
        // { next: { revalidate: 60 } }: Revalidate every 60 seconds
        const response = await fetch(apiUrl.toString(), { cache: 'no-store' });

        if (!response.ok) {
            fetchError = `Failed to load reminders. Status: ${response.status}`;
            console.error(`RemindersPage: API Error (${response.status}) for ${apiUrl.toString()}: ${await response.text()}`);
        } else {
            const data = await response.json();
            if (Array.isArray(data)) {
                reminders = data as Reminder[]; // Assume API returns Reminder[]
            } else {
                fetchError = "Received invalid data format from API.";
                console.error(`RemindersPage: Invalid data format received from ${apiUrl.toString()}:`, data);
                reminders = [];
            }
        }
    } catch (error: any) {
        console.error(`RemindersPage: Failed to fetch reminders:`, error);
        fetchError = "An error occurred while loading reminders.";
         if (error instanceof TypeError && error.message.includes('Invalid URL')) {
            fetchError = "Internal application configuration error (URL)."
         }
    }

    return { reminders, error: fetchError };
}


export default async function RemindersPage() {
  // Fetch data when the component renders on the server
  const { reminders, error: fetchError } = await getReminders();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl pt-10 font-bold tracking-tight">Reminders</h1>
        <p className="text-muted-foreground">Important deadlines and announcements</p>
      </div>

      {/* --- Display Error Message --- */}
      {fetchError && (
         <Alert variant="destructive" className="mb-4">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Error Loading Reminders</AlertTitle>
           <AlertDescription>{fetchError}</AlertDescription>
         </Alert>
      )}

      {/* --- Display Reminders --- */}
      <div className="grid gap-4">
        {!fetchError && reminders.length > 0 ? (
          reminders.map((reminder, index) => (
            <Card key={index} className="border-l-4 border-primary transition-all-smooth hover:shadow-md"> {/* Use index or a unique ID from sheet if available */}
              <CardHeader className="flex flex-row items-start gap-4 pb-2">
                {getIcon(reminder.iconType)} {/* Use the helper function for the icon */}
                <div>
                  <CardTitle>{reminder.title}</CardTitle>
                  {reminder.dueDate && (
                      <CardDescription>{reminder.dueDate}</CardDescription>
                  )}
                </div>
              </CardHeader>
              {reminder.description && ( // Only render CardContent if description exists
                  <CardContent>
                    {/* Simple paragraph, or use markdown rendering if needed */}
                    <p className="text-sm text-muted-foreground">{reminder.description}</p>
                  </CardContent>
              )}
            </Card>
          ))
        ) : (
          /* --- Display No Reminders Message --- */
          !fetchError && <p className="text-muted-foreground">No active reminders found.</p>
        )}
      </div>
    </div>
  );
}