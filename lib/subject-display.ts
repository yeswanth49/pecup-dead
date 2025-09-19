'use client'

interface SubjectLike {
  code?: string
  name?: string
}

export function getSubjectDisplay(subject: SubjectLike, preferAbbreviation = true): string {
  const code = subject?.code?.trim()
  const name = subject?.name?.trim()
  if (preferAbbreviation && code) return code.toUpperCase()
  return name || code?.toUpperCase() || ''
}

export function getSubjectDisplayByCode(
  subjects: SubjectLike[] | undefined,
  codeOrSlug: string,
  preferAbbreviation = true
): string {
  if (!codeOrSlug) return ''
  const normalized = codeOrSlug.trim().toLowerCase()
  if (normalized === '') return ''
  const list = Array.isArray(subjects) ? subjects : []
  const found = list.find(s => (s.code || '').toLowerCase() === normalized)
  if (found) return getSubjectDisplay(found, preferAbbreviation)
  return preferAbbreviation ? normalized.toUpperCase() : normalized
}

