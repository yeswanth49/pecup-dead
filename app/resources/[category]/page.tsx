import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"

// Define the categories and their subjects
const resourceData = {
  notes: {
    title: "Notes",
    description: "Lecture notes and study materials",
    subjects: ["Physics", "Mathematics", "Chemistry", "Biology", "Computer Science"],
  },
  assignments: {
    title: "Assignments",
    description: "Homework and practice problems",
    subjects: ["Physics", "Mathematics", "Chemistry", "Biology", "Computer Science"],
  },
  papers: {
    title: "Papers",
    description: "Research papers and publications",
    subjects: ["Physics", "Mathematics", "Chemistry", "Biology", "Computer Science"],
  },
  records: {
    title: "Records",
    description: "Academic records and transcripts",
    subjects: ["Physics", "Mathematics", "Chemistry", "Biology", "Computer Science"],
  },
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const category = params.category

  // Check if the category exists
  if (!resourceData[category as keyof typeof resourceData]) {
    notFound()
  }

  const categoryData = resourceData[category as keyof typeof resourceData]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center pt-10 gap-2 text-sm text-muted-foreground">
          <Link href="/resources" className="hover:text-foreground">
            Resources
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{categoryData.title}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{categoryData.title}</h1>
        <p className="text-muted-foreground">{categoryData.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoryData.subjects.map((subject) => (
          <Link
            key={subject}
            href={`/resources/${category}/${subject.toLowerCase().replace(/\s+/g, "-")}`}
            className="block"
          >
            <Card className="h-full transition-all-smooth hover-lift">
              <CardHeader>
                <CardTitle>{subject}</CardTitle>
                <CardDescription>
                  Access {subject} {categoryData.title.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-end">
                <ChevronRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

