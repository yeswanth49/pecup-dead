import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { FileText, BookOpen, FileCheck, Database } from "lucide-react"

export default function ResourcesPage() {
  const categories = [
    {
      name: "Notes",
      description: "Lecture notes and study materials",
      icon: FileText,
      path: "/resources/notes",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      name: "Assignments",
      description: "Homework and practice problems",
      icon: BookOpen,
      path: "/resources/assignments",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      name: "Papers",
      description: "Research papers and publications",
      icon: FileCheck,
      path: "/resources/papers",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      name: "Records",
      description: "Academic records and transcripts",
      icon: Database,
      path: "/resources/records",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl pt-10 font-bold tracking-tight">Resources</h1>
        <p className="text-muted-foreground">Access all educational materials organized by category</p>
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
          <CardTitle>Useful Resources</CardTitle>
          <CardDescription>mandatory and useful resources by PEC.UP</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <FileText className="h-4 w-4 text-primary" />
              <span><a href="">Syllabus</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li>
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <BookOpen className="h-4 w-4 text-primary" />
              <span><a href="">Mid-1 Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li>
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <FileCheck className="h-4 w-4 text-primary" />
              <span><a href="">Mid-2 Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li>
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <FileCheck className="h-4 w-4 text-primary" />
              <span><a href="">Sem Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

