"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { FileText, BookOpen, FileCheck, Database, Users, Loader2 } from "lucide-react"

import { useEffect, useMemo, useState } from 'react'
import { useProfile } from '@/lib/profile-context'
import { useEffect as useEffectClient } from 'react'
import { useSession } from 'next-auth/react'
import { useState as useStateClient } from 'react'
import { useCallback } from 'react'
import { use } from 'react'

function LiveUsersCount() {
  const [count, setCount] = useStateClient<number | null>(null)
  const [isLoading, setIsLoading] = useStateClient(true)

  useEffectClient(() => {
    let mounted = true
    async function fetchCount() {
      try {
        const res = await fetch('/api/users-count')
        if (!res.ok) return
        const data = await res.json()
        if (mounted) setCount(data.totalUsers)
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    fetchCount()
    const i = setInterval(fetchCount, 30000)
    return () => { mounted = false; clearInterval(i) }
  }, [])

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-md">
      <Users className="h-3 w-3 text-primary" />
      <div className="flex items-center gap-1">
        <span className="font-medium text-sm">
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : (count ?? 0).toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">users</span>
      </div>
    </div>
  )
}

export default function ResourcesPage() {
  const { profile } = useProfile()
  const [year, setYear] = useState<number | 'all'>('all')
  const [semester, setSemester] = useState<number | 'all'>('all')
  const [branch, setBranch] = useState<string | ''>('')

  useEffect(() => {
    // Use cached profile data instead of fetching
    if (profile) {
      if (year === 'all') setYear(profile.year)
      if (semester === 'all') setSemester(1)
      if (!branch) setBranch(profile.branch)
    }
  }, [profile, year, semester, branch])

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (year !== 'all') p.set('year', String(year))
    if (semester !== 'all') p.set('semester', String(semester))
    if (branch) p.set('branch', branch)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [year, semester, branch])
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
      description: "Assignment questions all batches",
      icon: BookOpen,
      path: "/resources/assignments",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      name: "Papers",
      description: "mid-1, mid-2, previous year papers",
      icon: FileCheck,
      path: "/resources/papers",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      name: "Records",
      description: "records and manuals for specific weeks",
      icon: Database,
      path: "/resources/records",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
      <Header/>
        <div className="flex items-start justify-between pt-2">
          <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
          <LiveUsersCount />
        </div>
        <p className="text-muted-foreground">Access all educational materials organized by category</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <Link key={category.name} href={`${category.path}${query}`} className="block">
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
              <span><a href="https://drive.google.com/file/d/1Eb7b2CQld4TMW9PuMEwOuqv3FRVWKpVe/view?usp=sharing">Syllabus</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li>
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <BookOpen className="h-4 w-4 text-primary" />
              <span><a href="https://drive.google.com/file/d/1uvZncVUjhuw-AxKh3BecklX2pMTBjSdy/view">Mid-1 Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li>
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <FileCheck className="h-4 w-4 text-primary" />
              <span><a href="https://drive.google.com/file/d/1X3ISvYPKOz_woK2aDXsWAQ4MiMu6tYvh/view">Mid-2 Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li>
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <FileCheck className="h-4 w-4 text-primary" />
              <span><a href="https://drive.google.com/file/d/1X6AQVCnm3ieDnLKZ5fwrZUVk4wRo2Qn_/view">Sem Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li>
          </ul>
        </CardContent>
      </Card>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}

