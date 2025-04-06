import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { BookOpen, Bell, Archive, Phone } from "lucide-react"

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl pt-10 font-bold tracking-tight">PEC.UP</h1>
        <p className="text-muted-foreground">Your central location for all educational resources and information</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/reminders" className="block">
          <Card className="h-full transition-all-smooth hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Reminders</CardTitle>
              <Bell className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>Important deadlines and announcements</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/resources" className="block">
          <Card className="h-full transition-all-smooth hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Resources</CardTitle>
              <BookOpen className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>Access notes, assignments, papers, and records</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/archive" className="block">
          <Card className="h-full transition-all-smooth hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Archive</CardTitle>
              <Archive className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>Previous semester materials and resources</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/contact" className="block">
          <Card className="h-full transition-all-smooth hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Contact</CardTitle>
              <Phone className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription>Get in touch with administration</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription>Latest changes to the resource hub</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-medium">New Assignment Resources Added</h3>
                <p className="text-sm text-muted-foreground">March 1, 2025</p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-medium">Updated Physics Notes for Unit 3</h3>
                <p className="text-sm text-muted-foreground">February 28, 2025</p>
              </div>
              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-medium">Archived Last Semester's Materials</h3>
                <p className="text-sm text-muted-foreground">February 25, 2025</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

