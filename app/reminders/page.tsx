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
              <CardDescription>8 April 2025</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p>
              Mid-term examinations for all subjects will begin on 8 April, 2025. Make sure to check the exam schedule
              and prepare accordingly.
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-primary transition-all-smooth hover:shadow-md">
          <CardHeader className="flex flex-row items-start gap-4 pb-2">
            <Clock className="mt-1 h-5 w-5 text-primary" />
            <div>
              <CardTitle>Assignment Submission</CardTitle>
              <CardDescription>Due in fewdays</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p>
              Submit all 5 assignments, all subjects within meantime!!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

