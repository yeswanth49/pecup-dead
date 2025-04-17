// app/reminders/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import {
  Loader2,
  CalendarClock,
  AlertCircle,
  Clock,
  Activity,
} from 'lucide-react'

interface Reminder {
  title: string
  dueDate: string
  description: string
  iconType?: string
}

// helper for icon
function getIcon(iconType?: string) {
  const cls = 'mt-1 h-5 w-5 text-primary'
  switch (iconType?.toLowerCase()) {
    case 'alert':
      return <AlertCircle className={cls} />
    case 'clock':
      return <Clock className={cls} />
    case 'calendar':
      return <CalendarClock className={cls} />
    default:
      return <Activity className={cls} />
  }
}

export default function RemindersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])

  useEffect(() => {
    async function fetchReminders() {
      setLoading(true)
      setError(null)

      try {
        // client‐side can hit the relative URL
        const res = await fetch('/api/reminders', { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Status ${res.status}`)
        }
        const data = await res.json()
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format')
        }
        setReminders(data)
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'An error occurred loading reminders.')
      } finally {
        setLoading(false)
      }
    }

    fetchReminders()
  }, [])

  // FULL‑SCREEN LOADER
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // ACTUAL PAGE
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="space-y-2">
        <Header/>
        <h1 className="text-3xl pt-10 font-bold tracking-tight">Reminders</h1>
        <p className="text-muted-foreground">
          Important deadlines and announcements
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Reminders</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && reminders.length === 0 && (
        <p className="text-muted-foreground">No active reminders found.</p>
      )}

      <div className="grid gap-4">
        {!error &&
          reminders.map((r, idx) => (
            <Card
              key={idx}
              className="border-l-4 border-primary transition-all-smooth hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-2">
                {getIcon(r.iconType)}
                <div>
                  <CardTitle>{r.title}</CardTitle>
                  {r.dueDate && (
                    <CardDescription>{r.dueDate}</CardDescription>
                  )}
                </div>
              </CardHeader>
              {r.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {r.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}