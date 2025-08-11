/*
  Seed sample resources across years (1..4) and semesters (1..2).
  Usage:
    pnpm ts-node scripts/seed-sample-resources.ts

  Requires SUPABASE env vars set; uses createSupabaseAdmin() (service role) server-side.
*/

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

type Category = 'notes' | 'assignments' | 'papers' | 'records'

const SUBJECTS = ['ps', 'dbms', 'mefa', 'os', 'se'] as const
const BRANCH: 'CSE' = 'CSE'

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in env')
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Ensure a regulation and a basic subject catalog
  const REG = process.env.SEED_REGULATION || 'R23'
  await supabase.from('regulations').upsert({ code: REG, effective_year: 2023 }, { onConflict: 'code' })
  const subjectRows = SUBJECTS.map((code) => ({ code, name: code.toUpperCase() }))
  await supabase.from('subjects').upsert(subjectRows, { onConflict: 'code' })
  const { data: subjectsData } = await supabase.from('subjects').select('id,code')
  const codeToId = new Map<string, string>((subjectsData || []).map((s: any) => [s.code, s.id]))
  const branches: string[] = ['CSE','AIML','DS','AI','ECE','EEE','MEC','CE']
  const offeringRows: any[] = []
  for (const branch of branches) {
    for (let year = 1; year <= 4; year++) {
      for (let semester = 1; semester <= 2; semester++) {
        for (const code of SUBJECTS) {
          const subject_id = codeToId.get(code)
          if (subject_id) offeringRows.push({ regulation: REG, branch, year, semester, subject_id })
        }
      }
    }
  }
  if (offeringRows.length) {
    await supabase.from('subject_offerings').upsert(offeringRows)
  }
  await supabase.from('record_templates').upsert({ names: ['Week 1','Week 2','Week 3','Week 4'] })
  await supabase.from('paper_templates').upsert({ names: ['Mid-1','Mid-2','Sem','Prev'] })

  const now = new Date()
  const baseUrl = 'https://example.com/sample.pdf'

  const rows: any[] = []

  for (let year = 1 as 1|2|3|4; year <= 4; year = (year + 1) as any) {
    for (let semester = 1 as 1|2; semester <= 2; semester = (semester + 1) as any) {
      for (const subject of SUBJECTS) {
        // Notes: Units 1..5
        for (let unit = 1; unit <= 5; unit++) {
          rows.push({
            category: 'notes',
            subject,
            unit,
            name: `${subject.toUpperCase()} Notes - Unit ${unit}`,
            description: `${ordinal(year)} Year, Sem ${semester} notes sample`,
            type: 'Notes',
            year,
            semester,
            branch: BRANCH,
            archived: false,
            url: baseUrl,
            is_pdf: true,
            date: now.toISOString(),
          })
        }

        // Assignments: Units 1..5
        for (let unit = 1; unit <= 5; unit++) {
          rows.push({
            category: 'assignments',
            subject,
            unit,
            name: `${subject.toUpperCase()} Assignment ${unit}`,
            description: `${ordinal(year)} Year, Sem ${semester} assignment sample`,
            type: 'Assignment',
            year,
            semester,
            branch: BRANCH,
            archived: false,
            url: baseUrl,
            is_pdf: true,
            date: now.toISOString(),
          })
        }

        // Papers: Units map 1..4 => Mid-1, Mid-2, Sem, Prev
        const paperLabels = ['Mid-1', 'Mid-2', 'Sem', 'Prev']
        for (let unit = 1; unit <= 4; unit++) {
          rows.push({
            category: 'papers',
            subject,
            unit,
            name: `${subject.toUpperCase()} ${paperLabels[unit - 1]} Paper`,
            description: `${ordinal(year)} Year, Sem ${semester} paper sample`,
            type: paperLabels[unit - 1],
            year,
            semester,
            branch: BRANCH,
            archived: unit === 4, // mark "Prev" as archived for demo
            url: baseUrl,
            is_pdf: true,
            date: now.toISOString(),
          })
        }

        // Records: Units 1..4 => Week 1..4
        for (let unit = 1; unit <= 4; unit++) {
          rows.push({
            category: 'records',
            subject,
            unit,
            name: `${subject.toUpperCase()} Record - Week ${unit}`,
            description: `${ordinal(year)} Year, Sem ${semester} record sample`,
            type: `Week ${unit}`,
            year,
            semester,
            branch: BRANCH,
            archived: semester === 1 && unit <= 2, // some archived examples
            url: baseUrl,
            is_pdf: true,
            date: now.toISOString(),
          })
        }
      }
    }
  }

  // Insert in chunks to avoid payload limits
  const chunkSize = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error, count } = await supabase.from('resources').insert(chunk, { count: 'exact' })
    if (error) {
      console.error('Insert chunk failed', error)
      process.exitCode = 1
      return
    }
    inserted += chunk.length
    console.log(`Inserted ${inserted}/${rows.length} resources...`)
  }

  console.log(`Done. Inserted ${inserted} sample resources.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


