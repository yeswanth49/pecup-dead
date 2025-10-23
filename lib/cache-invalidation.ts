'use client'

import { useCallback, useState } from 'react'
import { useProfile } from '@/lib/enhanced-profile-context'
import { ProfileCache, SubjectsCache, ResourcesCache } from '@/lib/simple-cache'

/**
 * Hook that exposes cache invalidation helpers for profile-related data.
 * - invalidateOnProfileUpdate: clears profile cache and refreshes bulk data
 * - invalidateOnSemesterChange: clears subjects and profile caches, then refreshes
 *
 * Examples:
 *   // After editing profile details in a settings form
 *   const { invalidateOnProfileUpdate } = useProfileInvalidation()
 *   await invalidateOnProfileUpdate()
 *
 *   // When a user changes academic semester/year/branch in a wizard
 *   const { invalidateOnSemesterChange } = useProfileInvalidation()
 *   await invalidateOnSemesterChange()
 *
 * Inputs/Context:
 * - Requires authenticated session via useProfile() context
 * - Uses ProfileCache/SubjectsCache for targeted invalidation
 *
 * Side-effects:
 * - Clears relevant caches, triggers refreshProfile()
 * - Exposes isLoading and error so callers can reflect state in UI
 */
export function useProfileInvalidation() {
  const { refreshProfile, profile } = useProfile()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const invalidateOnProfileUpdate = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG] Invalidating profile cache on update')
      }
      ProfileCache.clear()
      ResourcesCache.clearAll()
      await refreshProfile()
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(e?.message || 'Failed to refresh profile')
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [refreshProfile])

  const invalidateOnSemesterChange = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG] Invalidating cache on semester change')
      }
      ResourcesCache.clearAll()
      if (profile && profile.branch && profile.year && profile.semester != null) {
        SubjectsCache.clearForContext(profile.branch, profile.year, profile.semester)
      } else {
        SubjectsCache.clearAll()
      }
      ProfileCache.clear()
      await refreshProfile()
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(e?.message || 'Failed to refresh after semester change')
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [profile, refreshProfile])

  return {
    invalidateOnProfileUpdate,
    invalidateOnSemesterChange,
    isLoading,
    error
  }
}


