'use client'

import { useCallback } from 'react'
import { useProfile } from '@/lib/enhanced-profile-context'
import { ProfileCache, SubjectsCache } from '@/lib/simple-cache'

/**
 * Hook that exposes cache invalidation helpers for profile-related data.
 * - invalidateOnProfileUpdate: clears profile cache and refreshes bulk data
 * - invalidateOnSemesterChange: clears subjects and profile caches, then refreshes
 */
export function useProfileInvalidation() {
  const { refreshProfile, profile } = useProfile()

  const invalidateOnProfileUpdate = useCallback(async () => {
    ProfileCache.clear()
    await refreshProfile()
  }, [refreshProfile])

  const invalidateOnSemesterChange = useCallback(async () => {
    if (profile && profile.branch && profile.year && profile.semester != null) {
      SubjectsCache.clearAll()
    }
    ProfileCache.clear()
    await refreshProfile()
  }, [profile, refreshProfile])

  return {
    invalidateOnProfileUpdate,
    invalidateOnSemesterChange
  }
}


