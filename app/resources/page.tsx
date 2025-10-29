"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import ChatBubble from '@/components/ChatBubble'
import { FileText, BookOpen, FileCheck, Database, Users, Loader2 } from "lucide-react"
import { Badge } from '@/components/ui/badge'
import Loader from '@/components/Loader'

import { useEffect, useMemo, useState, useState as useStateClient } from 'react'
import { useProfile } from '@/lib/enhanced-profile-context'
import { useEffect as useEffectClient } from 'react'

const getRoleDisplay = (role: string) => {
  switch (role) {
    case 'student':
      return <Badge variant="secondary">Student</Badge>
    case 'representative':
      return <Badge variant="default">Representative</Badge>
    case 'admin':
      return <Badge variant="destructive">Admin</Badge>
    case 'yeshh':
      return <Badge variant="destructive">Yeshh</Badge>
    default:
      return <Badge variant="outline">{role}</Badge>
  }
}

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
          {isLoading ? <Loader /> : (count ?? 0).toLocaleString()}
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
      if (year === 'all') setYear(profile.year ?? ('all' as any))
      if (semester === 'all') setSemester(1)
      if (!branch && profile.branch) setBranch(profile.branch)
    }
  }, [profile, year, semester, branch])

  const query = useMemo(() => {
    const p = new URLSearchParams()
    // Ensure we pass batch_year (e.g., 2024) not an index
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
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Header />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Breadcrumb items={[
              { label: "Home", href: "/" },
              { label: "Resources", isCurrentPage: true }
            ]} />
          </div>
          <div className="flex items-center gap-4">
            {profile?.role && getRoleDisplay(profile.role)}
            <LiveUsersCount />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-center">Resources</h1>
          <p className="text-muted-foreground text-center">Access all resource materials organized by category</p>
        </div>
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
              <span><a href="https://drive.google.com/file/d/1iVaySLAjlTKk_dABrmPhAQt3x1rrxuiI/view?usp=sharing">Syllabus</a></span>
              <span className="ml-auto text-xs text-muted-foreground">28 October 2025</span>
            </li>
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <BookOpen className="h-4 w-4 text-primary" />
              <span><a href="https://drive.google.com/file/d/1R69NBdzUpX-h-HjOer63KTlhWfh2xymX/view?usp=sharing">Mid-1 Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">28 October 2025</span>
            </li>
            <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <FileCheck className="h-4 w-4 text-primary" />
              <span><a href="https://drive.google.com/file/d/1Noyor92EgQMpHARdUedBSy6GfOrMje24/view?usp=sharing">Mid-2 Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">28 October 2025</span>
            </li>
            {/* <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted transition-all duration-200">
              <FileCheck className="h-4 w-4 text-primary" />
              <span><a href="https://drive.google.com/file/d/1X6AQVCnm3ieDnLKZ5fwrZUVk4wRo2Qn_/view">Sem Timetable</a></span>
              <span className="ml-auto text-xs text-muted-foreground">16 April 2025</span>
            </li> */}
          </ul>
        </CardContent>
      </Card>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}

