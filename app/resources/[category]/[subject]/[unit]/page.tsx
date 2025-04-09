import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, FileText, Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

// Define the categories and their subjects (Ensure keys like "P&S", "DTA" are consistent)
const resourceData = {
  notes: {
    title: "Notes",
    subjects: {
      "p&s": { name: "P&S", units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"] },
      "dbms": { name: "DBMS", units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"] },
      "mefa": { name: "MEFA", units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"] },
      "os": { name: "OS", units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"] },
      "se": { name: "SE", units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"] },
    },
  },
  assignments: {
    title: "Assignments",
    subjects: {
      "p&s": { name: "P&S", units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"] },
      "dbms": { name: "DBMS", units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"] },
      "mefa": { name: "MEFA", units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"] },
      "os": { name: "OS", units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"] },
      "se": { name: "SE", units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"] },
    },
  },
  papers: {
    title: "Papers",
    subjects: {
      "p&s": { name: "P&S", units: ["Mid-1", "Mid-2", "Sem"] },
      "dbms": { name: "DBMS", units: ["Mid-1", "Mid-2", "Sem"] },
      "mefa": { name: "MEFA", units: ["Mid-1", "Mid-2", "Sem"] },
      "os": { name: "OS", units: ["Mid-1", "Mid-2", "Sem"] },
      "se": { name: "SE", units: ["Mid-1", "Mid-2", "Sem"] },
    },
  },
  records: {
    title: "Records",
    subjects: {
      "fds": { name: "FDS", units: ["Week 1", "Week 2", "Week 3"] },
      "dbms": { name: "DBMS", units: ["Week 1", "Week 2", "Week 3"] },
      "os": { name: "OS", units: ["Week 1", "Week 2", "Week 3"] },
       "dta": { name: "DTA", units: ["Week 1", "Week 2", "Week 3"] }, 
    },
  },
}

// Generate mock resources for each unit
// (No changes needed here, but it receives the decoded subject name)
function generateMockResources(category: string, subject: string, unitIndex: number) {
  const resources = []
  // ... (rest of the function remains the same)
  // Different types of resources based on category
  if (category === "notes") {
    resources.push(
      { title: "Lecture Notes 1", type: "PDF", date: "Apr 9, 2025", url: "https://www.google.com"  },
    )
  } else if (category === "assignments") {
    resources.push(
      { title: "Problem Set 1", type: "PDF", date: "Feb 10, 2025", url: "https://www.google.com"  },
      { title: "Problem Set 2", type: "PDF", date: "Feb 17, 2025" , url: "https://www.google.com" },
      { title: "Lab Assignment", type: "DOCX", date: "Feb 24, 2025", url: "https://www.google.com" },
      { title: "Practice Questions", type: "PDF", date: "Mar 1, 2025" },
      { title: "Quiz Preparation", type: "PDF", date: "Mar 2, 2025" },
    )
  } else if (category === "papers") {
    resources.push(
      { title: "Research Paper 1", type: "PDF", date: "Jan 15, 2025" },
      { title: "Research Paper 2", type: "PDF", date: "Jan 30, 2025" },
      { title: "Literature Review", type: "DOCX", date: "Feb 15, 2025" },
      { title: "Conference Paper", type: "PDF", date: "Feb 28, 2025" },
      { title: "Publication Guidelines", type: "PDF", date: "Mar 1, 2025" },
    )
  } else if (category === "records") {
    resources.push(
      { title: "Attendance Record", type: "PDF", date: "Dec 20, 2024" },
      { title: "Grade Report", type: "PDF", date: "Dec 25, 2024" },
      { title: "Transcript", type: "PDF", date: "Jan 5, 2025" },
      { title: "Performance Analysis", type: "PDF", date: "Jan 15, 2025" },
      { title: "Certificate", type: "PDF", date: "Jan 30, 2025" },
    )
  }
  return resources
}

// *** ADJUSTED UnitPage Component ***
export default async function UnitPage({ params }: { params: { category: string; subject: string; unit: string } }) {
  // Get category, ENCODED subject, and unit from params
  const { category, unit } = params;
  const encodedSubject = params.subject; // e.g., "P%26S"

  // DECODE the subject to get the original key ("P&S", "OS", etc.)
   let subject: string;
   try {
      subject = decodeURIComponent(encodedSubject);
   } catch (error) {
       console.error("Failed to decode subject parameter:", encodedSubject, error);
       notFound(); // Handle potential decoding errors
   }

  // Parse unit index
  const unitIndex = Number.parseInt(unit) - 1;

  // --- Data Validation using DECODED subject ---

  // Check if the category exists
  if (!resourceData[category as keyof typeof resourceData]) {
    console.error(`Category not found: ${category}`);
    notFound();
  }
  const categoryData = resourceData[category as keyof typeof resourceData];

  // Check if the subject exists using the DECODED key
  if (!categoryData.subjects[subject as keyof typeof categoryData.subjects]) {
     console.error(`Subject not found in category ${category}: ${subject} (decoded from ${encodedSubject})`);
     notFound();
  }
  const subjectData = categoryData.subjects[subject as keyof typeof categoryData.subjects];

  // Check if the unit exists
  if (unitIndex < 0 || unitIndex >= subjectData.units.length) {
    console.error(`Unit index out of bounds: ${unitIndex + 1} for subject ${subject}`);
    notFound();
  }

  // --- Get Data ---
  const unitName = subjectData.units[unitIndex];
  // Pass DECODED subject to mock resource generator
  const resources = generateMockResources(category, subject, unitIndex);

  return (
    <div className="space-y-6">
      {/* --- Breadcrumbs --- */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 pt-10 text-sm text-muted-foreground">
          <Link href="/resources" className="hover:text-foreground">
            Resources
          </Link>
          <ChevronRight className="h-4 w-4" />
          {/* Link to category page */}
          <Link href={`/resources/${category}`} className="hover:text-foreground">
            {categoryData.title}
          </Link>
          <ChevronRight className="h-4 w-4" />
          {/* Link to subject page *must* use the ENCODED subject */}
          <Link href={`/resources/${category}/${encodedSubject}`} className="hover:text-foreground">
            {subjectData.name} {/* Display DECODED name */}
          </Link>
          <ChevronRight className="h-4 w-4" />
          {/* Display unit number */}
          <span>Unit {Number.parseInt(unit)}</span>
        </div>

        {/* --- Page Title and Description --- */}
        {/* Use DECODED subject name for display */}
        <h1 className="text-3xl font-bold tracking-tight">{unitName}</h1>
        <p className="text-muted-foreground">
          {subjectData.name} {categoryData.title} for Unit {Number.parseInt(unit)}
        </p>
      </div>

      {/* --- Resource List --- */}
      <Card>
        <CardHeader>
          <CardTitle>Available Resources</CardTitle>
          <CardDescription>All materials for {unitName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {resources.map((resource, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 transition-all-smooth hover:shadow-md hover:border-primary"
              >
                {/* Resource details (no changes needed here) */}
                <div className="flex items-center gap-3 mb-3 sm:mb-0">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-medium">{resource.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {resource.type} • {resource.date}
                    </p>
                  </div>
                </div>
                {/* Action Buttons (no changes needed here unless links depend on subject/category names) */}
                <div className="flex gap-2">
                    <a href={resource.url}> {/* Assumes resource.url is absolute or correctly relative */}
                        <Button variant="outline" size="sm" className="transition-all hover:bg-primary hover:text-white">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                        </Button>
                    </a>
                    {/* If the "View" button constructed a URL, it might need encodedSubject */}
                    <Button variant="outline" size="sm" className="transition-all hover:bg-primary hover:text-white">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View
                    </Button>
                </div>

              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}