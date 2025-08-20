'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async () => {
    if (status !== 'authenticated') {
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
      setProfile(json?.profile || null)
    } catch (err: any) {
      setError(err.message || 'Error loading profile')
      console.error('Profile fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [status])

  const refetch = async () => {
    await fetchProfile()
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
