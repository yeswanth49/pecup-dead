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

  // Load profile from sessionStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined' && status === 'authenticated') {
      try {
        const cached = sessionStorage.getItem(PROFILE_STORAGE_KEY)
        if (cached) {
          const cachedProfile = JSON.parse(cached)
          // Verify the cached profile belongs to the current user
          if (cachedProfile.email === session?.user?.email) {
            setProfile(cachedProfile)
            setLoading(false)
            hasFetched.current = true
            return
          } else {
            // Different user, clear cache
            sessionStorage.removeItem(PROFILE_STORAGE_KEY)
          }
        }
      } catch (err) {
        console.warn('Failed to load cached profile:', err)
        sessionStorage.removeItem(PROFILE_STORAGE_KEY)
      }
    }
  }, [status, session?.user?.email])

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

  useEffect(() => {
    // Only fetch if we don't have cached data
    if (status === 'authenticated' && !hasFetched.current) {
      fetchProfile()
    } else if (status !== 'authenticated') {
      // Clear cache on logout
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(PROFILE_STORAGE_KEY)
      }
      setProfile(null)
      setLoading(false)
      hasFetched.current = false
    }
  }, [status])

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
