// app/resources/[category]/[subject]/[unit]/page.tsx

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Download, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Resource {
  name: string;
  description: string;
  date: string;
  type: string;
  url: string;
}

interface ApiResponse {
    resources: Resource[];
    subjectName?: string;
    categoryTitle?: string;
    unitName?: string;
}

export default async function UnitPage({ params }: { params: { category: string; subject: string; unit: string } }) {
  // 1. Await and Decode Params
  const resolvedParams = await params;
  const { category, unit } = resolvedParams;
  const encodedSubject = resolvedParams.subject;

  let subject = '';
  try {
     subject = decodeURIComponent(encodedSubject);
  } catch (error) {
      console.error("UnitPage: Failed to decode subject parameter:", encodedSubject, error);
      notFound();
  }

  const unitNumber = Number.parseInt(unit);
  if (isNaN(unitNumber) || unitNumber <= 0) {
      console.error(`UnitPage: Invalid unit number: ${unit}`);
      notFound();
  }

  // 2. Fetch Data from API
  let resources: Resource[] = [];
  let fetchError: string | null = null;
  let displayCategoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
  let displaySubjectName = subject; // Default - recommend improving API to return this
  let displayUnitName = `Unit ${unitNumber}`;

  try {
    // *** FIX: Construct Absolute URL ***
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`; // Get base URL from env var
    const relativeUrl = `/api/resources?category=${category}&subject=${encodedSubject}&unit=${unit}`;
    const apiUrl = new URL(relativeUrl, baseUrl); // Create full URL object

    console.log(`UnitPage: Fetching ${apiUrl.toString()}`);
    // Consider caching: remove/adjust `cache: 'no-store'` for production
    const response = await fetch(apiUrl.toString(), { cache: 'no-store' }); // Fetch using the absolute URL string

    if (!response.ok) {
       fetchError = `Failed to load resources. Status: ${response.status}`;
       console.error(`UnitPage: API Error (${response.status}) for ${apiUrl.toString()}: ${await response.text()}`);
    } else {
        // Try parsing JSON and check structure
        const data: ApiResponse | Resource[] = await response.json(); // Expect API response or just array

        if (data && typeof data === 'object' && 'resources' in data && Array.isArray(data.resources)) {
             // Handle enhanced API response { resources: [], subjectName: "..." }
             resources = data.resources;
             displaySubjectName = data.subjectName || displaySubjectName;
             displayCategoryTitle = data.categoryTitle || displayCategoryTitle;
             displayUnitName = data.unitName || displayUnitName;
        } else if (Array.isArray(data)) {
            // Handle simple API response: Resource[]
            resources = data;
             console.warn("UnitPage: API only returned resource array. Consider updating API to include names.");
        } else {
             fetchError = "Received invalid data format from API.";
             console.error(`UnitPage: Invalid data format received from ${apiUrl.toString()}:`, data);
             resources = []; // Ensure resources is an array even on format error
        }
    }
  } catch (error: any) {
      console.error(`UnitPage: Failed to fetch resources from ${encodedSubject}/${unit}:`, error);
      // Check for the specific URL parsing error as well
      if (error instanceof TypeError && error.message.includes('Invalid URL')) {
          fetchError = "Internal application configuration error (URL)."
      } else {
          fetchError = "An error occurred while loading resources.";
      }
  }

  // 3. Render Page (No changes needed in the JSX structure below)
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {/* --- Breadcrumbs --- */}
        <div className="flex flex-wrap items-center gap-2 pt-10 text-sm text-muted-foreground">
          <Link href="/resources" className="hover:text-foreground">Resources</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/resources/${category}`} className="hover:text-foreground">{displayCategoryTitle}</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/resources/${category}/${encodedSubject}`} className="hover:text-foreground">{displaySubjectName}</Link>
          <ChevronRight className="h-4 w-4" />
          <span>{displayUnitName}</span>
        </div>

        {/* --- Page Title and Description --- */}
        <h1 className="text-3xl font-bold tracking-tight">{displayUnitName}</h1>
        <p className="text-muted-foreground">
          {displaySubjectName} {displayCategoryTitle} for {displayUnitName}
        </p>
      </div>

      {/* --- Resource List --- */}
      <Card>
        <CardHeader>
          <CardTitle>Available Resources</CardTitle>
          <CardDescription>All materials for {displayUnitName}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Display Error Message if Fetch Failed */}
          {fetchError && (
             <Alert variant="destructive" className="mb-4">
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>Error</AlertTitle>
               <AlertDescription>{fetchError}</AlertDescription>
             </Alert>
          )}

          {/* Display Resource List or "No resources" message */}
          <div className="space-y-4">
            {!fetchError && resources.length > 0 ? (
              resources.map((resource) => (
                <div key={resource.url || resource.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 transition-all-smooth hover:shadow-md hover:border-primary">
                  <div className="flex items-center gap-3 mb-3 sm:mb-0">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-medium">{resource.name}</h3>
                      {resource.description && <p className="text-sm">{resource.description}</p>}
                      <p className="text-sm text-muted-foreground">
                        {resource.type} • {resource.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     {resource.url && resource.url !== '#' && (
                       <>
                         <a href={resource.url} download={resource.name}>
                           <Button variant="outline" size="sm" className="transition-all hover:bg-primary hover:text-white">
                             <Download className="mr-2 h-4 w-4" /> Download
                           </Button>
                         </a>
                         <a href={resource.url} target="_blank" rel="noopener noreferrer">
                           <Button variant="outline" size="sm" className="transition-all hover:bg-primary hover:text-white">
                             <ExternalLink className="mr-2 h-4 w-4" /> View
                           </Button>
                         </a>
                       </>
                     )}
                  </div>
                </div>
              ))
            ) : (
              !fetchError && <p className="text-muted-foreground">No resources available for this unit.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}