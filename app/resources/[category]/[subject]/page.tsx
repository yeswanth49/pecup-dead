import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, FileText } from "lucide-react"

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

export async function generateStaticParams() {
  const params = []
  for (const category of Object.keys(resourceData)) {
    const subjectKeys = Object.keys(resourceData[category].subjects)
    for (const subjectKey of subjectKeys) {
      params.push({
        category,
        subject: encodeURIComponent(subjectKey)
      })
    }
  }
  return params
}

export default async function SubjectPage({ params }: { params: { category: string; subject: string } }) {

  const resolvedParams = await params;

  const { category } = resolvedParams;
  const encodedSubject = resolvedParams.subject; 

  let subject: string;
  try {
     subject = decodeURIComponent(encodedSubject); 
  } catch (error) {
      console.error("Failed to decode subject parameter:", encodedSubject, error);
      notFound();
  }


  if (!resourceData[category as keyof typeof resourceData]) {
    console.error(`Category not found: ${category}`);
    notFound();
  }
  const categoryData = resourceData[category as keyof typeof resourceData];

  if (!categoryData.subjects[subject as keyof typeof categoryData.subjects]) {
    console.error(`Subject not found in category ${category}: ${subject} (decoded from ${encodedSubject})`);
    notFound();
  }

  const subjectData = categoryData.subjects[subject as keyof typeof categoryData.subjects];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center pt-10 gap-2 text-sm text-muted-foreground">
          <Link href="/resources" className="hover:text-foreground">
            Resources
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/resources/${category}`} className="hover:text-foreground">
            {categoryData.title}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{subjectData.name}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {subjectData.name} {categoryData.title}
        </h1>
        <p className="text-muted-foreground">
          Access all {subjectData.name} {categoryData.title} by unit
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjectData.units.map((unit, index) => (
          <Link key={unit} href={`/resources/${category}/${encodedSubject}/${index + 1}`} className="block">
            <Card className="h-full transition-all-smooth hover-lift">
              <CardHeader>
                <CardTitle>
                  {unit}
                </CardTitle>
                <CardDescription>Access {subject.toUpperCase()} {unit}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <FileText className="h-5 w-5 text-primary" />
                <ChevronRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}