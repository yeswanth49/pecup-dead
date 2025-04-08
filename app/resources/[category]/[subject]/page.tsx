import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, FileText } from "lucide-react"

// Define the categories and their subjects
const resourceData = {
  notes: {
    title: "Notes",
    subjects: {
      physics: {
        name: "Physics",
        units: ["Mechanics", "Thermodynamics", "Electromagnetism", "Optics", "Modern Physics"],
      },
      mathematics: {
        name: "Mathematics",
        units: ["Calculus", "Linear Algebra", "Probability", "Statistics", "Differential Equations"],
      },
      chemistry: {
        name: "Chemistry",
        units: [
          "Organic Chemistry",
          "Inorganic Chemistry",
          "Physical Chemistry",
          "Analytical Chemistry",
          "Biochemistry",
        ],
      },
      biology: {
        name: "Biology",
        units: ["Cell Biology", "Genetics", "Ecology", "Physiology", "Evolution"],
      },
      "computer-science": {
        name: "Computer Science",
        units: ["Algorithms", "Data Structures", "Operating Systems", "Databases", "Computer Networks"],
      },
    },
  },
  assignments: {
    title: "Assignments",
    subjects: {
      physics: {
        name: "Physics",
        units: ["Mechanics", "Thermodynamics", "Electromagnetism", "Optics", "Modern Physics"],
      },
      mathematics: {
        name: "Mathematics",
        units: ["Calculus", "Linear Algebra", "Probability", "Statistics", "Differential Equations"],
      },
      chemistry: {
        name: "Chemistry",
        units: [
          "Organic Chemistry",
          "Inorganic Chemistry",
          "Physical Chemistry",
          "Analytical Chemistry",
          "Biochemistry",
        ],
      },
      biology: {
        name: "Biology",
        units: ["Cell Biology", "Genetics", "Ecology", "Physiology", "Evolution"],
      },
      "computer-science": {
        name: "Computer Science",
        units: ["Algorithms", "Data Structures", "Operating Systems", "Databases", "Computer Networks"],
      },
    },
  },
  papers: {
    title: "Papers",
    subjects: {
      physics: {
        name: "Physics",
        units: ["Mechanics", "Thermodynamics", "Electromagnetism", "Optics", "Modern Physics"],
      },
      mathematics: {
        name: "Mathematics",
        units: ["Calculus", "Linear Algebra", "Probability", "Statistics", "Differential Equations"],
      },
      chemistry: {
        name: "Chemistry",
        units: [
          "Organic Chemistry",
          "Inorganic Chemistry",
          "Physical Chemistry",
          "Analytical Chemistry",
          "Biochemistry",
        ],
      },
      biology: {
        name: "Biology",
        units: ["Cell Biology", "Genetics", "Ecology", "Physiology", "Evolution"],
      },
      "computer-science": {
        name: "Computer Science",
        units: ["Algorithms", "Data Structures", "Operating Systems", "Databases", "Computer Networks"],
      },
    },
  },
  records: {
    title: "Records",
    subjects: {
      physics: {
        name: "Physics",
        units: ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5"],
      },
      mathematics: {
        name: "Mathematics",
        units: ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5"],
      },
      chemistry: {
        name: "Chemistry",
        units: ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5"],
      },
      biology: {
        name: "Biology",
        units: ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5"],
      },
      "computer-science": {
        name: "Computer Science",
        units: ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5"],
      },
    },
  },
}

export default function SubjectPage({ params }: { params: { category: string; subject: string } }) {
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
