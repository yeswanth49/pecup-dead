"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useSessionCachedResource } from './session-cache'
import { ProfileCache } from './simple-cache'

export interface Profile {
  id: string
  email: string
  name: string
  year: number
  branch: string
  roll_number: string
  semester?: {
    semester_number: number
  }
}

interface ProfileContextType {
  profile: Profile | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  subjects: { code: string; name: string; resource_type?: string }[]
  refreshSubjects: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

const PROFILE_STORAGE_KEY = 'user_profile_cache' // legacy key for migration/cleanup
const SESSION_CACHE_PREFIX = 'session_cache_v1'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)
  const isInitialized = useRef(false)

  // Immediately try to clean up any legacy cache on mount and avoid SSR issues
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { sessionStorage.removeItem(PROFILE_STORAGE_KEY) } catch (e) { console.error('Failed legacy profile cleanup', e) }
    }
  }, [])

  const fetchProfile = async (force = false) => {
    if (status !== 'authenticated') {
      setLoading(false)
      return
    }

    // If we already have profile data and not forcing refresh, skip fetch
    if (!force && hasFetched.current && profile) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('Failed to load profile')
      }
      
      const json = await res.json()
      const profileData = json?.profile || null
      
      setProfile(profileData)
      hasFetched.current = true
      
      // Cache the profile using the secure ProfileCache
      if (profileData && session?.user?.email) {
        ProfileCache.set(session.user.email, profileData)
      }
    } catch (err: any) {
      setError(err.message || 'Error loading profile')
      console.error('Profile fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle authentication state changes
  useEffect(() => {
    if (status === 'authenticated' && !hasFetched.current && !profile) {
      if (session?.user?.email) {
        const cachedProfile = ProfileCache.get(session.user.email)
        const isValidProfile = (p: any): p is Profile => {
          return !!p && typeof p === 'object' &&
                 typeof p.id === 'string' &&
                 typeof p.email === 'string' &&
                 typeof p.name === 'string' &&
                 typeof p.year === 'number' &&
                 typeof p.branch === 'string' &&
                 typeof p.roll_number === 'string'
        }
        if (isValidProfile(cachedProfile)) {
          setProfile(cachedProfile)
          setLoading(false)
          hasFetched.current = true
        } else {
          if (cachedProfile) { ProfileCache.clear() }
          fetchProfile()
        }
      }
    } else if (status === 'unauthenticated') {
      // Clear everything on logout
      setLoading(false)
      setProfile(null)
      hasFetched.current = false
      ProfileCache.clear()
    }
  }, [status, session?.user?.email])

  const refetch = async () => {
    // Clear cache before refetching
    ProfileCache.clear()
    hasFetched.current = false
    await fetchProfile(true)
  }

  // Subjects cache using session cache hook
  const subjectsKey = profile ? `subjects:year=${profile.year}:branch=${profile.branch}` : 'subjects:anon'
  const subjectsFetcher = async () => {
    // Don't fetch subjects if we don't have complete profile data
    if (!profile) {
      return []
    }
    const params = new URLSearchParams()
    params.set('year', String(profile.year))
    params.set('branch', profile.branch)
    const res = await fetch(`/api/subjects?${params.toString()}`)
    const json = await res.json()
    return json.subjects || []
  }

  const { data: subjectsData, refresh: refreshSubjects } = useSessionCachedResource(subjectsKey, subjectsFetcher, [profile?.year, profile?.branch])

  return (
    <ProfileContext.Provider value={{ profile, loading, error, refetch, subjects: subjectsData || [], refreshSubjects }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}

// Generic hook to provide stale-while-revalidate caching in sessionStorage.
// Components can call this with a unique key (can include query params) and a fetcher
// function that returns the desired data array/object.
// re-export from shared session-cache implementation
export { useSessionCachedResource }
