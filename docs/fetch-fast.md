# Fast Fetch Implementation Plan

## Overview

This document outlines a simplified, practical implementation plan to optimize data fetching performance by reducing redundant API calls by ~80% through bulk fetching and smart caching. The approach is designed to be implemented incrementally without over-engineering.

## Current State Analysis

### Performance Issues Identified
1. **Redundant Profile Lookups**: Multiple APIs (`/api/profile`, `/api/subjects`, `/api/recent-updates`, `/api/reminders`) all fetch profile data independently
2. **Separate API Calls**: Each component makes individual API calls for related data
3. **Inefficient Caching**: Current session cache is per-endpoint, leading to cache misses
4. **Multiple Database Queries**: Each API endpoint performs separate database queries for user context

### Current Architecture
- **Profile Context**: Uses `sessionStorage` for profile caching with `useSessionCachedResource` hook
- **Subject Fetching**: Separate API call to `/api/subjects` with profile-based filtering
- **Dynamic Data**: Individual APIs for recent updates, exams, and reminders
- **Session Cache**: Generic `useSessionCachedResource` utility with 5-minute background revalidation

## Implementation Plan

### API Reference (Implemented)

**Endpoint**: `GET /api/bulk-academic-data`

**Success response (shape):**
```json
{
  "profile": {
    "id": "uuid",
    "roll_number": "",
    "name": "",
    "email": "",
    "section": "",
    "role": "student",
    "year": 1,
    "branch": "CSE",
    "semester": 1
  },
  "subjects": [
    { "id": "uuid", "code": "CS101", "name": "Programming", "resource_type": "theory" }
  ],
  "static": {
    "branches": [ { "id": "uuid", "name": "Computer Science", "code": "CSE" } ],
    "years": [ { "id": "uuid", "batch_year": 2023, "display_name": "2nd Year" } ],
    "semesters": [ { "id": "uuid", "semester_number": 1 } ]
  },
  "dynamic": {
    "recentUpdates": [ { "id": "uuid", "title": "...", "created_at": "..." } ],
    "upcomingExams": [ { "subject": "CS101", "exam_date": "YYYY-MM-DD", "year": 1, "branch": "CSE" } ],
    "upcomingReminders": [ { "id": "uuid", "title": "...", "due_date": "YYYY-MM-DD" } ]
  },
  "contextWarnings": [],
  "timestamp": 1720000000000,
  "meta": {
    "loadedInMs": 123,
    "timings": { "profileMs": 10, "subjectsMs": 20, "staticMs": 30, "dynamicMs": 40 }
  }
}
```

**Error response (shape):**
```json
{
  "ok": false,
  "error": { "code": "UNAUTHORIZED", "message": "Unauthorized" },
  "meta": { "timestamp": 1720000000000, "path": "/api/bulk-academic-data" }
}
```

Notes:
- The backend auto-detects regulation from `subject_offerings` when possible, and sorts `subjects` by `display_order`.
- When profile context is incomplete, a `contextWarnings` array is included.

### Phase 1: Simple Bulk API + Naive Caching (Week 1-2)

#### Step 1: Create Bulk Academic Data API

**File**: `app/api/bulk-academic-data/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createSupabaseAdmin } from '@/lib/supabase'
import { AcademicConfigManager } from '@/lib/academic-config'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createSupabaseAdmin()
    const academicConfig = AcademicConfigManager.getInstance()
    
    // Single query to get profile with relations
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        id, roll_number, name, email, branch_id, year_id, semester_id, section, role,
        branch:branches(id, name, code),
        year:years(id, batch_year, display_name),
        semester:semesters(id, semester_number)
      `)
      .eq('email', email)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Calculate current academic year
    const currentYear = profile.year?.batch_year ? 
      await academicConfig.calculateAcademicYear(profile.year.batch_year) : 1
    const branchCode = profile.branch?.code
    const semester = profile.semester?.semester_number || 1

    // Fetch everything in parallel
    const [subjectsResult, staticDataResults, dynamicDataResults] = await Promise.all([
      // Subjects for user's context
      branchCode ? supabase
        .from('subject_offerings')
        .select('subject_id, display_order')
        .eq('regulation', 'R23')
        .eq('year', currentYear)
        .eq('branch', branchCode)
        .eq('semester', semester)
        .eq('active', true)
        .order('display_order', { ascending: true })
        .then(async ({ data: offerings }) => {
          if (!offerings?.length) return { data: [] }
          const subjectIds = offerings.map(o => o.subject_id)
          return supabase
            .from('subjects')
            .select('id, code, name, resource_type')
            .in('id', subjectIds)
        }) : Promise.resolve({ data: [] }),

      // Static data - fetch all at once
      Promise.all([
        supabase.from('branches').select('*'),
        supabase.from('years').select('*'),
        supabase.from('semesters').select('*')
      ]),

      // Dynamic data - recent updates, exams, reminders
      Promise.all([
        supabase
          .from('recent_updates')
          .select('*')
          .eq('year', currentYear)
          .eq('branch', branchCode)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('exams')
          .select('subject, exam_date')
          .gte('exam_date', new Date().toISOString().slice(0, 10))
          .lte('exam_date', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
          .order('exam_date', { ascending: true }),
        supabase
          .from('reminders')
          .select('*')
          .eq('year', currentYear)
          .eq('branch', branchCode)
          .gte('due_date', new Date().toISOString().slice(0, 10))
          .order('due_date', { ascending: true })
          .limit(5)
      ])
    ])

    const [branches, years, semesters] = staticDataResults
    const [recentUpdates, upcomingExams, upcomingReminders] = dynamicDataResults

    return NextResponse.json({
      profile: {
        ...profile,
        year: currentYear,
        branch: branchCode || 'Unknown'
      },
      subjects: subjectsResult.data || [],
      static: {
        branches: branches.data || [],
        years: years.data || [],
        semesters: semesters.data || [],
      },
      dynamic: {
        recentUpdates: recentUpdates.data || [],
        upcomingExams: upcomingExams.data || [],
        upcomingReminders: upcomingReminders.data || []
      },
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Bulk fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
```

#### Step 2: Cache Utilities (Implemented)

**File**: `lib/simple-cache.ts`

- **ProfileCache**: sessionStorage, whitelists safe fields; clears on user mismatch
- **StaticCache**: localStorage with 30-day TTL; handles quota exceeded with retry
- **SubjectsCache**: localStorage per-context key `subjects_{branch}_{year}_{semester}`; cleans up on quota
- **DynamicCache**: sessionStorage with 10-minute TTL; safe clear on parse errors

#### Step 3: Update Profile Context

**File**: `lib/enhanced-profile-context.tsx`

```typescript
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { ProfileCache, StaticCache, SubjectsCache, DynamicCache } from './simple-cache'

interface Profile {
  id: string
  name: string
  email: string
  roll_number: string
  branch: string
  year: number
  semester: number
  section: string
  role: string
}

interface Subject {
  id: string
  code: string
  name: string
  resource_type: string
}

interface ProfileContextType {
  profile: Profile | null
  subjects: Subject[]
  staticData: any
  dynamicData: any
  loading: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  refreshSubjects: () => Promise<void>
  forceRefresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [staticData, setStaticData] = useState<any>(null)
  const [dynamicData, setDynamicData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load from cache on mount
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) {
      setLoading(false)
      return
    }

    const email = session.user.email
    
    // Try to load cached data
    const cachedProfile = ProfileCache.get(email)
    const cachedStatic = StaticCache.get()
    const cachedDynamic = DynamicCache.get()
    
    let foundCache = false
    
    if (cachedProfile) {
      setProfile(cachedProfile)
      foundCache = true
      
      // Try to load subjects for this profile
      if (cachedProfile.branch && cachedProfile.year && cachedProfile.semester) {
        const cachedSubjects = SubjectsCache.get(
          cachedProfile.branch, 
          cachedProfile.year, 
          cachedProfile.semester
        )
        if (cachedSubjects) {
          setSubjects(cachedSubjects)
        }
      }
    }
    
    if (cachedStatic) {
      setStaticData(cachedStatic)
      foundCache = true
    }
    
    if (cachedDynamic) {
      setDynamicData(cachedDynamic)
      foundCache = true
    }
    
    if (foundCache) {
      setLoading(false)
      // Still fetch fresh data in background, but don't show loading
      fetchBulkData(false)
    } else {
      // No cache, fetch and show loading
      fetchBulkData(true)
    }
  }, [session?.user?.email, status])

  const fetchBulkData = async (showLoading = true) => {
    if (status !== 'authenticated' || !session?.user?.email) return
    
    if (showLoading) setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/bulk-academic-data')
      if (!response.ok) throw new Error('Failed to fetch data')
      
      const data = await response.json()
      
      // Update state
      setProfile(data.profile)
      setSubjects(data.subjects)
      setStaticData(data.static)
      setDynamicData(data.dynamic)
      
      // Update caches
      ProfileCache.set(session.user.email, data.profile)
      StaticCache.set(data.static)
      DynamicCache.set(data.dynamic)
      
      if (data.profile?.branch && data.profile?.year && data.profile?.semester) {
        SubjectsCache.set(
          data.profile.branch,
          data.profile.year,
          data.profile.semester,
          data.subjects
        )
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
      console.error('Bulk fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Simple invalidation on user actions
  const refreshProfile = async () => {
    if (!session?.user?.email) return
    ProfileCache.clear()
    await fetchBulkData(true)
  }

  const refreshSubjects = async () => {
    if (!profile) return
    SubjectsCache.clearForContext(profile.branch, profile.year, profile.semester)
    await fetchBulkData(true)
  }

  // Force refresh button
  const forceRefresh = async () => {
    ProfileCache.clear()
    StaticCache.clear()
    DynamicCache.clear()
    if (profile) {
      SubjectsCache.clearForContext(profile.branch, profile.year, profile.semester)
    }
    await fetchBulkData(true)
  }

  return (
    <ProfileContext.Provider value={{
      profile,
      subjects,
      staticData,
      dynamicData,
      loading,
      error,
      refreshProfile,
      refreshSubjects,
      forceRefresh
    }}>
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
```

Client usage example:
```tsx
import { useProfile } from '@/lib/enhanced-profile-context'

export function DashboardHeader() {
  const { profile, dynamicData, loading, error, warnings, forceRefresh } = useProfile()
  if (loading) return <div>Loading…</div>
  if (error) return <div className="text-red-600">{error}</div>
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold">Hi, {profile?.name ?? profile?.email}</div>
        {Array.isArray(warnings) && warnings.length > 0 && (
          <div className="text-amber-600 text-sm">{warnings[0]}</div>
        )}
      </div>
      <button onClick={forceRefresh}>Refresh</button>
    </div>
  )
}
```

#### Step 4: Create Refresh Component

**File**: `components/RefreshButton.tsx`

```tsx
'use client'

import { useProfile } from '@/lib/enhanced-profile-context'

export function RefreshButton() {
  const { forceRefresh, loading } = useProfile()
  
  return (
    <button 
      onClick={forceRefresh}
      disabled={loading}
      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
    >
      {loading ? 'Refreshing...' : '🔄 Refresh Data'}
    </button>
  )
}
```

#### Step 5: Update Layout to Use New Context

**File**: `app/(protected)/layout.tsx`

```tsx
import { ReactNode } from 'react'
import { ProfileProvider } from '@/lib/enhanced-profile-context'
import { Header } from '@/components/Header'
import { RefreshButton } from '@/components/RefreshButton'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <RefreshButton />
          </div>
          {children}
        </div>
      </div>
    </ProfileProvider>
  )
}
```

#### Step 6: Update Components to Use Bulk Data

**Update existing components to use the new context instead of individual API calls:**

1. **Home Page** - Use `dynamicData.recentUpdates` instead of `/api/recent-updates`
2. **Resource Pages** - Use `subjects` from context instead of `/api/subjects`
3. **Profile Page** - Use `profile` from context instead of `/api/profile`

### Phase 2: Smart Invalidation + Refresh on Focus (Week 3-4)

#### Step 7: Add Refresh on Visibility Change

**Update**: `lib/enhanced-profile-context.tsx`

```typescript
// Add to ProfileProvider
useEffect(() => {
  if (typeof window === 'undefined') return
  
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && profile) {
      // Only refresh dynamic data on focus
      const cached = DynamicCache.get()
      if (!cached) {
        fetchBulkData(false) // Background refresh, no loading spinner
      }
    }
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [profile])
```

#### Step 8: Simple Invalidation Hooks

**File**: `lib/cache-invalidation.ts`

```typescript
import { useCallback } from 'react'
import { useProfile } from './enhanced-profile-context'
import { ProfileCache, SubjectsCache } from './simple-cache'

export function useProfileInvalidation() {
  const { refreshProfile } = useProfile()
  
  const invalidateOnProfileUpdate = useCallback(() => {
    ProfileCache.clear()
    refreshProfile()
  }, [refreshProfile])
  
  const invalidateOnSemesterChange = useCallback(() => {
    SubjectsCache.clearAll()
    ProfileCache.clear()
    refreshProfile()
  }, [refreshProfile])
  
  return {
    invalidateOnProfileUpdate,
    invalidateOnSemesterChange
  }
}
```

#### Step 9: Add Cache Debugging

**File**: `components/CacheDebugger.tsx` (Development only)

```tsx
'use client'

import { useState } from 'react'
import { ProfileCache, StaticCache, SubjectsCache, DynamicCache } from '@/lib/simple-cache'

export function CacheDebugger() {
  const [showDebug, setShowDebug] = useState(false)
  
  if (process.env.NODE_ENV !== 'development') return null
  
  const clearAllCaches = () => {
    ProfileCache.clear()
    StaticCache.clear()
    DynamicCache.clear()
    SubjectsCache.clearAll()
    alert('All caches cleared!')
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="bg-gray-800 text-white px-3 py-1 rounded text-xs"
      >
        Debug Cache
      </button>
      
      {showDebug && (
        <div className="absolute bottom-8 right-0 bg-white border shadow-lg p-4 rounded w-64">
          <h3 className="font-bold mb-2">Cache Status</h3>
          <div className="space-y-2 text-xs">
            <div>Profile: {ProfileCache.get('dummy') ? '✅' : '❌'}</div>
            <div>Static: {StaticCache.get() ? '✅' : '❌'}</div>
            <div>Dynamic: {DynamicCache.get() ? '✅' : '❌'}</div>
          </div>
          <button
            onClick={clearAllCaches}
            className="mt-2 bg-red-500 text-white px-2 py-1 rounded text-xs w-full"
          >
            Clear All Caches
          </button>
        </div>
      )}
    </div>
  )
}
```

### Phase 3: Performance Monitoring & Optimization (Week 5-6)

#### Step 10: Add Performance Metrics

**File**: `lib/performance-monitor.ts`

```typescript
'use client'

interface PerformanceMetric {
  operation: string
  duration: number
  cacheHit: boolean
  timestamp: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  
  startOperation(operation: string) {
    return {
      operation,
      startTime: performance.now(),
      end: (cacheHit = false) => {
        const duration = performance.now() - this.startTime
        this.metrics.push({
          operation,
          duration,
          cacheHit,
          timestamp: Date.now()
        })
        
        // Keep only last 100 metrics
        if (this.metrics.length > 100) {
          this.metrics = this.metrics.slice(-100)
        }
        
        console.log(`[PERF] ${operation}: ${duration.toFixed(2)}ms ${cacheHit ? '(cache hit)' : '(network)'}`)
      }
    }
  }
  
  getMetrics() {
    return this.metrics
  }
  
  getAverageLoadTime() {
    const networkCalls = this.metrics.filter(m => !m.cacheHit)
    if (networkCalls.length === 0) return 0
    
    const total = networkCalls.reduce((sum, m) => sum + m.duration, 0)
    return total / networkCalls.length
  }
  
  getCacheHitRate() {
    if (this.metrics.length === 0) return 0
    const cacheHits = this.metrics.filter(m => m.cacheHit).length
    return (cacheHits / this.metrics.length) * 100
  }
}

export const performanceMonitor = new PerformanceMonitor()
```

#### Step 11: Integration Testing

**File**: `__tests__/bulk-fetch.test.ts`

```typescript
import { GET } from '@/app/api/bulk-academic-data/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/supabase', () => ({
  createSupabaseAdmin: jest.fn()
}))

describe('/api/bulk-academic-data', () => {
  it('should return bulk data for authenticated user', async () => {
    // Test implementation
  })
  
  it('should return 401 for unauthenticated user', async () => {
    // Test implementation
  })
  
  it('should handle database errors gracefully', async () => {
    // Test implementation
  })
})
```

## Implementation Checklist

### Week 1
- [ ] Create bulk API endpoint (`app/api/bulk-academic-data/route.ts`)
- [ ] Create simple cache utilities (`lib/simple-cache.ts`)
- [ ] Test bulk API with Postman/curl
- [ ] Verify cache utilities work in browser

### Week 2
- [ ] Update profile context (`lib/enhanced-profile-context.tsx`)
- [ ] Create refresh button component (`components/RefreshButton.tsx`)
- [ ] Update protected layout to use new context
- [ ] Test cache loading and invalidation

### Week 3
- [ ] Add visibility change handler for background refresh
- [ ] Create cache invalidation hooks (`lib/cache-invalidation.ts`)
- [ ] Update components to use bulk data instead of individual APIs
- [ ] Test cross-tab synchronization

### Week 4
- [ ] Add cache debugger component for development
- [ ] Performance testing and optimization
- [ ] Error handling improvements
- [ ] Documentation updates

### Week 5-6
- [ ] Add performance monitoring (`lib/performance-monitor.ts`)
- [ ] Integration testing
- [ ] Load testing with realistic user scenarios
- [ ] Production deployment and monitoring

## Expected Performance Improvements

### Before Implementation
- **API Calls per Page Load**: 4-6 calls
- **Average Load Time**: 800-1200ms
- **Cache Hit Rate**: ~20%
- **Database Queries**: 8-12 per page load

### After Implementation
- **API Calls per Page Load**: 1 call (first load), 0 calls (cached)
- **Average Load Time**: 200-400ms (cached), 300-600ms (network)
- **Cache Hit Rate**: ~80%
- **Database Queries**: 3-4 per page load

### Key Benefits
1. **80% reduction in API calls** through bulk fetching
2. **60% faster load times** with smart caching
3. **Better user experience** with instant cache loading
4. **Reduced server load** with fewer database queries
5. **Improved reliability** with cache fallbacks

## Monitoring & Maintenance

### Key Metrics to Track
- Cache hit rates by cache type
- Average API response times
- Database query counts
- User session duration
- Error rates

### Cache Invalidation Strategy
- **Profile Cache**: Clear on profile updates, user role changes
- **Static Cache**: Manual invalidation, 30-day TTL
- **Subjects Cache**: Clear on semester changes, manual admin updates
- **Dynamic Cache**: 10-minute TTL, refresh on focus

### Rollback Plan
If issues arise, the implementation can be rolled back by:
1. Reverting to original profile context
2. Re-enabling individual API endpoints
3. Disabling bulk API endpoint
4. Clearing all caches

This incremental approach ensures minimal risk while delivering significant performance improvements.
