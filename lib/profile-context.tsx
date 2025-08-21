'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { useSession } from 'next-auth/react'

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
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

const PROFILE_STORAGE_KEY = 'user_profile_cache'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)
  const isInitialized = useRef(false)

  // Immediately try to load from cache on mount
  useEffect(() => {
    console.log('ProfileContext: Mount effect running')
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(PROFILE_STORAGE_KEY)
        console.log('ProfileContext: Cached data found:', !!cached)
        if (cached) {
          const cachedProfile = JSON.parse(cached)
          console.log('ProfileContext: Setting cached profile:', cachedProfile)
          setProfile(cachedProfile)
          setLoading(false)
          hasFetched.current = true
          return
        }
      } catch (err) {
        console.warn('Failed to load cached profile on mount:', err)
        sessionStorage.removeItem(PROFILE_STORAGE_KEY)
      }
    }
    console.log('ProfileContext: No cache found, setting loading to false')
    setLoading(false) // If no cache, set loading to false initially
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
      
      // Cache the profile data in sessionStorage
      if (profileData && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileData))
        } catch (err) {
          console.warn('Failed to cache profile:', err)
        }
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
      // Only fetch if we don't have cached profile data and haven't fetched yet
      if (session?.user?.email) {
        // Verify cached profile belongs to current user
        if (typeof window !== 'undefined') {
          const cached = sessionStorage.getItem(PROFILE_STORAGE_KEY)
          if (cached) {
            try {
              const cachedProfile = JSON.parse(cached)
              if (cachedProfile.email !== session.user.email) {
                // Different user, clear cache and fetch
                sessionStorage.removeItem(PROFILE_STORAGE_KEY)
                setProfile(null)
                fetchProfile()
              }
              // If same user, we already loaded from cache in the mount effect
            } catch (err) {
              sessionStorage.removeItem(PROFILE_STORAGE_KEY)
              setProfile(null)
              fetchProfile()
            }
          } else {
            // No cache, need to fetch
            fetchProfile()
          }
        }
      }
    } else if (status === 'unauthenticated') {
      // Clear everything on logout
      setLoading(false)
      setProfile(null)
      hasFetched.current = false
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(PROFILE_STORAGE_KEY)
      }
    }
  }, [status, session?.user?.email])

  const refetch = async () => {
    // Clear cache before refetching
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(PROFILE_STORAGE_KEY)
    }
    hasFetched.current = false
    await fetchProfile(true)
  }

  return (
    <ProfileContext.Provider value={{ profile, loading, error, refetch }}>
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
