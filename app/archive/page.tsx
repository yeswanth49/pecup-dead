"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import ChatBubble from '@/components/ChatBubble'
import { FileText, BookOpen, FileCheck, Database, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'

export default function ArchivePage() {
  const [year, setYear] = useState<number | 'all'>('all')
  const [semester, setSemester] = useState<number | 'all'>('all')
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
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Header />

      <div className="space-y-4">
        <Breadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Archive", isCurrentPage: true }
        ]} />

        <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-center flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-center">Archive</h1>
            <p className="text-muted-foreground text-center">Access previous semester materials and resources</p>
          </div>
          <span className="text-sm text-muted-foreground">{year !== 'all' ? `${year} Year` : 'All Years'}{semester !== 'all' ? `, ${semester} Sem` : ''}</span>
        </div>
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
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="min-w-[140px]">
              <Select value={year === 'all' ? 'all' : String(year)} onValueChange={(v) => setYear(v === 'all' ? 'all' : Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {[1,2,3,4].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Select value={semester === 'all' ? 'all' : String(semester)} onValueChange={(v) => setSemester(v === 'all' ? 'all' : Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {[1,2].map((s) => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
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