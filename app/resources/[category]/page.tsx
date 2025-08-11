"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight } from "lucide-react"
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const resourceData = {
  notes: {
    title: "Notes",
    description: "Lecture notes and study materials",
  },
  assignments: {
    title: "Assignments",
    description: "Assignment questions all batches",
  },
  papers: {
    title: "Papers",
    description: "mid-1, mid-2, previous year papers",
  },
  records: {
    title: "Records",
    description: "records and manuals for specific weeks",
  },
} as const

// Note: no generateStaticParams here since this is a client component

export default function CategoryPage({ params }: { params: { category: string } }) {
  const { category } = params
  if (!resourceData[category as keyof typeof resourceData]) {
    return null
  }
  const categoryData = resourceData[category as keyof typeof resourceData]

  const [subjects, setSubjects] = useState<{ code: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const qp = new URLSearchParams()
        const year = searchParams.get('year')
        const semester = searchParams.get('semester')
        const branch = searchParams.get('branch')
        if (year) qp.set('year', year)
        if (semester) qp.set('semester', semester)
        if (branch) qp.set('branch', branch)
        const res = await fetch(`/api/subjects?${qp.toString()}`, { cache: 'no-store' })
        const json = await res.json()
        setSubjects(json?.subjects || [])
      } catch {
        setSubjects([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [searchParams])

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
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{categoryData.title}</h1>
          <span className="text-sm text-muted-foreground">
            {typeof searchParams.year === 'string' ? `${searchParams.year} Year` : 'All Years'}{typeof searchParams.semester === 'string' ? `, ${searchParams.semester} Sem` : ''}
          </span>
        </div>
        <p className="text-muted-foreground">{categoryData.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!loading && subjects.map((s) => {
          const qp = new URLSearchParams()
          const year = searchParams.get('year')
          const semester = searchParams.get('semester')
          const branch = searchParams.get('branch')
          if (year) qp.set('year', year)
          if (semester) qp.set('semester', semester)
          if (branch) qp.set('branch', branch)
          const q = qp.toString()

          return (
            <Link key={s.code} href={`/resources/${category}/${encodeURIComponent(s.code)}${q ? `?${q}` : ''}`} className="block">
              <Card className="h-full transition-all-smooth hover-lift">
                <CardHeader>
                  <CardTitle>{s.name}</CardTitle>
                  <CardDescription>Access {s.name} {categoryData.title.toUpperCase()}</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-end">
                  <ChevronRight className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
        {!loading && subjects.length === 0 && (
          <div className="text-sm text-muted-foreground">No subjects configured for your context.</div>
        )}
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}