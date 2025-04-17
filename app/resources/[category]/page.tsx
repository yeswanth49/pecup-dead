import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight } from "lucide-react"

const resourceData = {
  notes: {
    title: "Notes",
    description: "Lecture notes and study materials",
    subjects: ["p&s", "dbms", "mefa", "os", "SE"],
  },
  assignments: {
    title: "Assignments",
    description: "Homework and practice problems",
    subjects: ["p&s", "dbms", "mefa", "os", "SE"],
  },
  papers: {
    title: "Papers",
    description: "Research papers and publications",
    subjects: ["p&s", "dbms", "mefa", "os", "SE"],
  },
  records: {
    title: "Records",
    description: "Academic records and transcripts",
    subjects: ["fds", "dbms", "os", "dti"], 
  },
}

export async function generateStaticParams() {
  return Object.keys(resourceData).map((category) => ({
    category,
  }))
}

export default async function CategoryPage({ params }: { params: { category: string } }) {
    const { category } = await params

  if (!resourceData[category as keyof typeof resourceData]) {
    notFound()
  }

  const categoryData = resourceData[category as keyof typeof resourceData]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
      <Header/>
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
        {categoryData.subjects.map((subject) => {
          const pathSegment = subject.toLowerCase().replace(/\s+/g, "-");

          return (
            <Link
              key={subject}
              href={`/resources/${category}/${encodeURIComponent(pathSegment)}`}
              className="block"
            >
              <Card className="h-full transition-all-smooth hover-lift">
                <CardHeader>
                  <CardTitle>{subject.toUpperCase()}</CardTitle>
                  <CardDescription>
                    Access {subject.toUpperCase()} {categoryData.title.toUpperCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-end">
                  <ChevronRight className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}