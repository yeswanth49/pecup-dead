import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarClock, AlertCircle, Clock } from "lucide-react"

export default function RemindersPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl pt-10 font-bold tracking-tight">Reminders</h1>
        <p className="text-muted-foreground">Important deadlines and announcements to keep track of</p>
      </div>

      <div className="grid gap-4">
        <Card className="border-l-4 border-primary transition-all-smooth hover:shadow-md">
          <CardHeader className="flex flex-row items-start gap-4 pb-2">
            <AlertCircle className="mt-1 h-5 w-5 text-primary" />
            <div>
              <CardTitle>Mid-Term Exams</CardTitle>
              <CardDescription>Due in 5 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p>
              Mid-term examinations for all subjects will begin on March 7, 2025. Make sure to check the exam schedule
              and prepare accordingly.
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-primary transition-all-smooth hover:shadow-md">
          <CardHeader className="flex flex-row items-start gap-4 pb-2">
            <Clock className="mt-1 h-5 w-5 text-primary" />
            <div>
              <CardTitle>Assignment Submission</CardTitle>
              <CardDescription>Due tomorrow</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p>
              Physics and Mathematics assignments are due by 11:59 PM tomorrow. Late submissions will incur penalties.
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-primary transition-all-smooth hover:shadow-md">
          <CardHeader className="flex flex-row items-start gap-4 pb-2">
            <CalendarClock className="mt-1 h-5 w-5 text-primary" />
            <div>
              <CardTitle>Research Paper Proposal</CardTitle>
              <CardDescription>Due in 2 weeks</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p>
              Submit your research paper proposals by March 16, 2025. Guidelines are available in the Resources section
              under Papers.
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-primary transition-all-smooth hover:shadow-md">
          <CardHeader className="flex flex-row items-start gap-4 pb-2">
            <CalendarClock className="mt-1 h-5 w-5 text-primary" />
            <div>
              <CardTitle>Course Registration</CardTitle>
              <CardDescription>Opens in 3 weeks</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p>
              Registration for next semester courses will open on March 23, 2025. Review the course catalog and prepare
              your schedule in advance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

