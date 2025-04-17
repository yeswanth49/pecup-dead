import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { FileText, BookOpen, FileCheck, Database, ChevronRight } from "lucide-react"

export default function ArchivePage() {
  const categories = [
    {
      name: "Notes",
      description: "Archived lecture notes and study materials",
      icon: FileText,
      path: "/archive/coming-soon", 
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      name: "Assignments",
      description: "Archived homework and practice problems",
      icon: BookOpen,
      path: "/archive/coming-soon", 
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      name: "Papers",
      description: "Archived research papers and publications",
      icon: FileCheck,
      path: "/archive/coming-soon", 
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      name: "Records",
      description: "Archived academic records and transcripts",
      icon: Database,
      path: "/archive/coming-soon", 
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
  ]

  const semesters = [
    {
      name: "Year 1 Sem 1 R23",
      path: "/archive/coming-soon", 
    },
    {
      name: "Year 1 Sem 2 R23",
      path: "/archive/coming-soon", 
    },
    {
      name: "Year 2 Sem 1 R23",
      path: "/archive/coming-soon", 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
      <Header/>
        <h1 className="text-3xl pt-10 font-bold tracking-tight">Archive</h1>
        <p className="text-muted-foreground">Access previous semester materials and resources</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <Link key={category.name} href={category.path} className="block">
            <Card className="h-full transition-all-smooth hover-lift">
              <CardHeader className={`rounded-t-lg ${category.color}`}>
                <div className="flex items-center gap-3">
                  <category.icon className={`h-6 w-6 ${category.iconColor}`} />
                  <CardTitle className="text-xl">{category.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <CardDescription className="text-sm">{category.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Browse by Semester</CardTitle>
          <CardDescription>Access archived materials by semester</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {semesters.map((semester) => (
              <Link key={semester.name} href={semester.path}>
                <div className="flex items-center justify-between rounded-md p-3 hover:bg-muted transition-all duration-200 hover:text-primary">
                  <span className="font-medium">{semester.name}</span>
                  <ChevronRight className="h-5 w-5 text-primary" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}