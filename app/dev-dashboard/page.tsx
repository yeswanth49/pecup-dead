// app/developer-dashboard/page.tsx (Refined)
'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import ResourceUploadForm from '@/components/ResourceUploadForm';

// Load authorized emails (client-side)
// const authorizedEmails = (process.env.NEXT_PUBLIC_AUTHORIZED_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);

// --- Simple Card Component (Example - Replace with your UI library's Card if available) ---
const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-card text-card-foreground border rounded-lg shadow-md p-6 ${className}`}>
    {children}
  </div>
);
// --- End Simple Card Component ---


export default function DeveloperDashboardPage() {
  const { data: session, status } = useSession();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // Use state for authorization status

  const isLoading = status === 'loading';

  useEffect(() => {
    // If loading is finished, determine authorization status
    if (!isLoading) {
      if (!session) {
        // Not authenticated, prompt sign in (can customize this)
         signIn('google'); // Or show a sign-in button
         setIsAuthorized(false); // Mark as not authorized
      } else {
        // Authenticated, check email
        // const authorized = session.user?.email && authorizedEmails.includes(session.user.email);
        // setIsAuthorized(authorized);
        setIsAuthorized(true); // Allow all authenticated users
        // if (!authorized) {
        //     console.warn(`Unauthorized access attempt by: ${session.user?.email}`);
        // }
      }
    }
  }, [session, status, isLoading]); // Dependency array

  // --- Loading State ---
  if (isLoading || isAuthorized === null) { // Show loading until authorization status is determined
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading user session...</p> {/* Replace with a spinner */}
      </div>
    );
  }

  // --- Unauthorized State ---
  if (!isAuthorized) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-center p-4">
         <Card className="max-w-md">
            <h1 className="text-xl font-semibold text-destructive mb-4">Access Denied</h1>
            <p className="mb-4">
                This account ({session?.user?.email || 'Unknown'}) is not authorized to view this developer dashboard.
            </p>
            <p className="mb-6">
                If you have an authorized account, please sign out and sign back in with the correct credentials.
            </p>
            <button
                onClick={() => signOut({ callbackUrl: '/api/auth/signin' })} // Sign out and redirect to sign-in
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors"
            >
                Sign Out and Sign In Again
            </button>
         </Card>
      </div>
    );
  }

  // --- Authorized State ---
  // User is authenticated and authorized, show the dashboard
  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Developer Dashboard</h1>
            <p className="text-muted-foreground">
                Welcome, {session?.user?.name}! Manage resources below.
            </p>
        </div>

        <Card className="max-w-2xl mx-auto"> {/* Center the upload form card */}
            <h2 className="text-xl font-semibold mb-4">Upload New Resource</h2>
            <ResourceUploadForm />
        </Card>

        {/* You could add other dashboard sections here */}
    </div>
  );
}