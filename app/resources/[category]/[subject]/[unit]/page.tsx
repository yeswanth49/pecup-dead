import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, FileText, Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    },
  },
}

// Generate mock resources for each unit
function generateMockResources(category: string, subject: string, unitIndex: number) {
  const resources = []

  // Different types of resources based on category
  if (category === "notes") {
    resources.push(
      { title: "Lecture Notes 1", type: "PDF", date: "Feb 15, 2025" },
      { title: "Lecture Notes 2", type: "PDF", date: "Feb 22, 2025" },
      { title: "Study Guide", type: "DOCX", date: "Feb 28, 2025" },
      { title: "Concept Map", type: "PDF", date: "Mar 1, 2025" },
      { title: "Summary Sheet", type: "PDF", date: "Mar 2, 2025" },
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

export default async function UnitPage({ params }: { params: { category: string; subject: string; unit: string } }) {
  const { category, subject, unit } = params
  const unitIndex = Number.parseInt(unit) - 1

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

  // Check if the unit exists
  if (unitIndex < 0 || unitIndex >= subjectData.units.length) {
    notFound()
  }

  const unitName = subjectData.units[unitIndex]
  const resources = generateMockResources(category, subject, unitIndex)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 pt-10 text-sm text-muted-foreground">
          <Link href="/resources" className="hover:text-foreground">
            Resources
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/resources/${category}`} className="hover:text-foreground">
            {categoryData.title}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/resources/${category}/${subject}`} className="hover:text-foreground">
            {subjectData.name}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>Unit {Number.parseInt(unit)}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{unitName}</h1>
        <p className="text-muted-foreground">
          {subjectData.name} {categoryData.title} for Unit {Number.parseInt(unit)}
        </p>
      </div>

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
                <div className="flex items-center gap-3 mb-3 sm:mb-0">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-medium">{resource.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {resource.type} • {resource.date}
                    </p>
                  </div>
                </div>
                  <div className="flex gap-2">
              {/* --- Download Button --- */}
              <a href={resource.url}> {/* Use <a> tag with 'download' attribute */}
                <Button variant="outline" size="sm" className="transition-all hover:bg-primary hover:text-white">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </a>
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

