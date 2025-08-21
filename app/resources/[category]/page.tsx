import Link from "next/link"
import { Header } from '@/components/Header'
import ChatBubble from '@/components/ChatBubble'
import { ChevronRight } from "lucide-react"
import { notFound } from 'next/navigation'
import ResourcesFiltersClient from './ResourcesFiltersClient'

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

export default function CategoryPage({ params, searchParams }: { 
  params: { category: string }
  searchParams: { year?: string; semester?: string; branch?: string }
}) {
  const { category } = params
  if (!resourceData[category as keyof typeof resourceData]) {
    notFound()
  }
  const categoryData = resourceData[category as keyof typeof resourceData]

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
        <div className="flex items-start">
          <h1 className="text-3xl font-bold tracking-tight">{categoryData.title}</h1>
        </div>
        <p className="text-muted-foreground">{categoryData.description}</p>
      </div>

      <ResourcesFiltersClient category={category} categoryData={categoryData} />
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  )
}