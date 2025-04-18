// app/resources/[category]/[subject]/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight, FileText } from "lucide-react"

// 1) Your data – no changes here
const resourceData = {
  notes: {
    title: "Notes",
    subjects: {
      "ps": {
        name: "P&S",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
      dbms: {
        name: "DBMS",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
      mefa: {
        name: "MEFA",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
      os: {
        name: "OS",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
      se: {
        name: "SE",
        units: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"],
      },
    },
  },
  assignments: {
    title: "Assignments",
    subjects: {
      "ps": {
        name: "P&S",
        units: [
          "Assignment 1",
          "Assignment 2",
          "Assignment 3",
          "Assignment 4",
          "Assignment 5",
        ],
      },
      dbms: {
        name: "DBMS",
        units: [
          "Assignment 1",
          "Assignment 2",
          "Assignment 3",
          "Assignment 4",
          "Assignment 5",
        ],
      },
      mefa: {
        name: "MEFA",
        units: [
          "Assignment 1",
          "Assignment 2",
          "Assignment 3",
          "Assignment 4",
          "Assignment 5",
        ],
      },
      os: {
        name: "OS",
        units: [
          "Assignment 1",
          "Assignment 2",
          "Assignment 3",
          "Assignment 4",
          "Assignment 5",
        ],
      },
      se: {
        name: "SE",
        units: [
          "Assignment 1",
          "Assignment 2",
          "Assignment 3",
          "Assignment 4",
          "Assignment 5",
        ],
      },
    },
  },
  papers: {
    title: "Papers",
    subjects: {
      ps: { name: "P&S", units: ["Mid-1", "Mid-2", "Sem"] },
      dbms: { name: "DBMS", units: ["Mid-1", "Mid-2", "Sem"] },
      mefa: { name: "MEFA", units: ["Mid-1", "Mid-2", "Sem"] },
      os: { name: "OS", units: ["Mid-1", "Mid-2", "Sem"] },
      se: { name: "SE", units: ["Mid-1", "Mid-2", "Sem"] },
    },
  },
  records: {
    title: "Records",
    subjects: {
      fds: { name: "FDS", units: ["Week 1", "Week 2", "Week 3"] },
      dbms: { name: "DBMS", units: ["Week 1", "Week 2", "Week 3"] },
      os: { name: "OS", units: ["Week 1", "Week 2", "Week 3"] },
      dta: { name: "DTA", units: ["Week 1", "Week 2", "Week 3"] },
    },
  },
}

// 2) Statically generate all (category, subject) paths
export async function generateStaticParams() {
  const params: { category: string; subject: string }[] = []

  for (const category of Object.keys(resourceData)) {
    for (const subjectKey of Object.keys(
      resourceData[category as keyof typeof resourceData].subjects
    )) {
      params.push({
        category,
        subject: encodeURIComponent(subjectKey),
      })
    }
  }

  return params
}

// 3) The page component
export default async function SubjectPage({
  params,
}: {
  params: { category: string; subject: string }
}) {
  const { category } = params
  let decodedSubject: string

  // decode & validate
  try {
    decodedSubject = decodeURIComponent(params.subject)
  } catch {
    return notFound()
  }

  const categoryData = resourceData[category as keyof typeof resourceData]
  if (!categoryData) return notFound()

  const subjectData =
    categoryData.subjects[decodedSubject as keyof typeof categoryData.subjects]
  if (!subjectData) return notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
      <Header/>
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
          <Link
            key={unit}
            href={`/resources/${category}/${params.subject}/${index + 1}`}
            className="block"
          >
            <Card className="h-full transition-all-smooth hover-lift">
              <CardHeader>
                <CardTitle>{unit}</CardTitle>
                <CardDescription>
                  Access {subjectData.name.toUpperCase()} {unit}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex items-center justify-between">
                {/* ← THIS is where you can swap the left‑hand icon: */}
                <FileText className="h-5 w-5 text-primary" />

                {/* ← AND this is the chevron on the right: */}
                <ChevronRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}