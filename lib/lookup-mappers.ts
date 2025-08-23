import { createSupabaseAdmin } from '@/lib/supabase'

// Small cache to avoid repeated DB lookups during a single request
const cache: { branches?: Record<string,string>, years?: Record<string,string>, semesters?: Record<string, Record<number,string>> } = {}

export async function getBranchIdByCode(code: string) {
  if (!code) return null
  if (cache.branches && cache.branches[code]) return cache.branches[code]
  const supabase = createSupabaseAdmin()
  const { data } = await supabase.from('branches').select('id,code').eq('code', code).maybeSingle()
  if (!cache.branches) cache.branches = {}
  if (data && data.id) cache.branches[data.code] = data.id
  return data?.id || null
}

export async function getYearIdByBatchYear(batchYear: number) {
  if (!batchYear) return null
  if (cache.years && cache.years[String(batchYear)]) return cache.years[String(batchYear)]
  const supabase = createSupabaseAdmin()
  const { data } = await supabase.from('years').select('id,batch_year').eq('batch_year', batchYear).maybeSingle()
  if (!cache.years) cache.years = {}
  if (data && data.id) cache.years[String(data.batch_year)] = data.id
  return data?.id || null
}

export async function getSemesterId(yearId: string, semesterNumber: number) {
  if (!yearId || !semesterNumber) return null
  if (cache.semesters && cache.semesters[yearId] && cache.semesters[yearId][semesterNumber]) return cache.semesters[yearId][semesterNumber]
  const supabase = createSupabaseAdmin()
  const { data } = await supabase.from('semesters').select('id,semester_number,year_id').eq('year_id', yearId).eq('semester_number', semesterNumber).maybeSingle()
  if (!cache.semesters) cache.semesters = {}
  if (!cache.semesters[yearId]) cache.semesters[yearId] = {}
  if (data && data.id) cache.semesters[yearId][data.semester_number] = data.id
  return data?.id || null
}

export function clearLookupCache() {
  cache.branches = undefined
  cache.years = undefined
  cache.semesters = undefined
}


