import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, FileText } from "lucide-react"

// Define the categories and their subjects
const resourceData = {
  notes: {
    title: "Notes",
    subjects: {
      "P&S": {
        name: "P&S",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
      "DBMS": {
        name: "DBMS",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
      "MEFA": {
        name: "MEFA",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
      "OS": {
        name: "OS",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
      "SE": {
        name: "SE",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
    },
  },
  assignments: {
    title: "Assignments",
    subjects: {
      "P&S": {
        name: "P&S",
        units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"],
      },
      "DBMS": {
        name: "DBMS",
        units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"],
      },
      "MEFA": {
        name: "MEFA",
        units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"],
      },
      "OS": {
        name: "OS",
        units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"],
      },
      "SE": {
        name: "SE",
        units: ["Assignment 1", "Assignment 2", "Assignment 3", "Assignment 4", "Assignment 5"],
      },
    },
  },
  papers: {
    title: "Papers",
    subjects: {
      "P&S": {
        name: "P&S",
        units: ["Mid-1", "Mid-2", "Sem"],
      },
      "DBMS": {
        name: "DBMS",
        units: ["Mid-1", "Mid-2", "Sem"],
      },
      "MEFA": {
        name: "MEFA",
        units: ["Mid-1", "Mid-2", "Sem"],
      },
      "OS": {
        name: "OS",
        units: ["Mid-1", "Mid-2", "Sem"],
      },
      "SE": {
        name: "SE",
        units: ["Mid-1", "Mid-2", "Sem"],
      },
    },
  },
  records: {
    title: "Records",
    subjects: {
      "FDS": {
        name: "FDS",
        units: ["Week 1", "Week 2", "Week 3"],
      },
      "DBMS": {
        name: "DBMS",
        units: ["Week 1", "Week 2", "Week 3"],
      },
      "OS": {
        name: "OS",
        units: ["Week 1", "Week 2", "Week 3"],
      },
      "DTA": {
        name: "DTA",
        units: ["Week 1", "Week 2", "Week 3"],
      },
    },
  },
}

export default async function SubjectPage({ params }: { params: { category: string; subject: string } }) {
  const { category, subject } = params

  // Check if the category exists
  if (!resourceData[category as keyof typeof resourceData]) {
    notFound()
  }

  // Check if the subject exists
  const categoryData = resourceData[category as keyof typeof resourceData]
  if (!categoryData.subjects[subject as keyof typeof categoryData.subjects]) {
    notFound()
  }

  const subjectData = categoryData.subjects[subject as keyof typeof categoryData.subjects]

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
          Access all {subjectData.name} {categoryData.title.toLowerCase()} by unit
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjectData.units.map((unit, index) => (
          <Link key={unit} href={`/resources/${category}/${subject}/${index + 1}`} className="block">
            <Card className="h-full transition-all-smooth hover-lift">
              <CardHeader>
                <CardTitle>
                  Unit {index + 1}: {unit}
                </CardTitle>
                <CardDescription>Access {unit} materials</CardDescription>
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
