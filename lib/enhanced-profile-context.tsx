'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { ProfileCache, StaticCache, SubjectsCache, DynamicCache, ProfileDisplayCache, ResourcesCache } from './simple-cache'
import { PerfMon } from './performance-monitor'
import { broadcastBulkCacheUpdate, subscribeToBulkCacheUpdates } from './cross-tab'

// Narrow shapes for bulk static and dynamic data with safe extensibility
export interface EnhancedProfileStaticData {
	branches?: Array<{ id: string; name?: string; code?: string }>
	years?: Array<{ id: string; batch_year?: number; display_name?: string }>
	semesters?: Array<{ id: string; semester_number?: number; year_id?: string }>
	subjects?: Array<{ id: string; code: string; name: string; resource_type?: string }>
	[key: string]: unknown
}

export interface EnhancedProfileDynamicData {
	recentUpdates?: Array<{ id: string; title?: string; created_at?: string }>
	reminders?: Array<{ id: string; title?: string; due_date?: string; completed?: boolean }>
	upcomingExams?: Array<{ subject: string; exam_date: string; branch: string; year: string }>
	upcomingReminders?: Array<{ id: string; title?: string; due_date?: string; completed?: boolean }>
	resourcesCount?: number
	usersCount?: number
	lastSyncedAt?: string
	[key: string]: unknown
}

// Type guard for EnhancedProfileStaticData
function isEnhancedProfileStaticData(obj: unknown): obj is EnhancedProfileStaticData {
	return obj !== null && typeof obj === 'object'
}

// Type guard for EnhancedProfileDynamicData
function isEnhancedProfileDynamicData(obj: unknown): obj is EnhancedProfileDynamicData {
	return obj !== null && typeof obj === 'object'
}

interface Profile {
	id: string
	name?: string
	email: string
	roll_number?: string
	branch?: string | null
	year?: number | null
	semester?: number | null
	section?: string
	role?: string
}

export interface Subject {
	id: string
	code: string
	name: string
	resource_type?: string
}

export interface ProfileContextType {
	profile: Profile | null
	subjects: Subject[]
	staticData: EnhancedProfileStaticData | null
	dynamicData: EnhancedProfileDynamicData | null
	resources: Record<string, Record<string, any[]>> | null
	loading: boolean
	error: string | null
	warnings?: string[] | null
	refreshProfile: () => Promise<void>
	refreshSubjects: () => Promise<void>
	forceRefresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
	const { data: session, status } = useSession()
	const [profile, setProfile] = useState<Profile | null>(null)
	const [subjects, setSubjects] = useState<Subject[]>([])
	const [staticData, setStaticData] = useState<EnhancedProfileStaticData | null>(null)
	const [dynamicData, setDynamicData] = useState<EnhancedProfileDynamicData | null>(null)
	const [resources, setResources] = useState<Record<string, Record<string, any[]>> | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [warnings, setWarnings] = useState<string[] | null>(null)

	// Load from cache on mount
	useEffect(() => {
		if (status !== 'authenticated' || !session?.user?.email) {
			// Clear all in-memory state and caches when user is not authenticated
			setProfile(null)
			setSubjects([])
			setStaticData(null)
			setDynamicData(null)
			setResources(null)
			setError(null)
			setWarnings(null)

			// Clear all caches to ensure clean slate for next user
			ProfileCache.clear()
			try { ProfileDisplayCache.clear() } catch (_) { }
			StaticCache.clear()
			DynamicCache.clear()
			SubjectsCache.clearAll()

			setLoading(false)
			return
		}

		const email = session.user.email


		// Try to load cached data and record cache checks
		const cachedProfile = ProfileCache.get(email)
		PerfMon.recordCacheCheck(!!cachedProfile)
		const cachedStatic = StaticCache.get(isEnhancedProfileStaticData)
		PerfMon.recordCacheCheck(!!cachedStatic)
		const cachedDynamic = DynamicCache.get(isEnhancedProfileDynamicData)
		PerfMon.recordCacheCheck(!!cachedDynamic)

		let foundCache = false

		if (cachedProfile) {
			setProfile(cachedProfile)
			// Seed persistent display cache for instant header render
			try { ProfileDisplayCache.set(email, cachedProfile) } catch (_) { }
			foundCache = true

			// Try to load subjects for this profile
			let cachedSubjects: Subject[] | null = null
			if (cachedProfile && typeof cachedProfile.year === 'number' && cachedProfile.year > 0 && cachedProfile.branch && cachedProfile.semester) {
				cachedSubjects = SubjectsCache.get(
					cachedProfile.branch,
					cachedProfile.year,
					cachedProfile.semester
				)
				PerfMon.recordCacheCheck(!!cachedSubjects)
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
			// Only refresh in background when dynamic cache is missing/expired
			if (!cachedDynamic) {
				fetchBulkData(false).catch((err) => {
					if (process.env.NODE_ENV !== 'production') {
						// eslint-disable-next-line no-console
						console.error('Background refresh failed (cached present):', err)
					}
				})
			}
		} else {
			// No cache, fetch with spinner
			fetchBulkData(true).catch((err) => {
				if (process.env.NODE_ENV !== 'production') {
					// eslint-disable-next-line no-console
					console.error('Initial fetch failed (no cache):', err)
				}
			})
		}

		// Log cache status for debugging
		if (process.env.NODE_ENV !== 'production') {
			let subjectsCount = 0
			if (cachedProfile && typeof cachedProfile.year === 'number' && cachedProfile.year > 0 && cachedProfile.branch && cachedProfile.semester) {
				const subjects = SubjectsCache.get(cachedProfile.branch, cachedProfile.year, cachedProfile.semester)
				subjectsCount = subjects?.length || 0
			}
			console.log('[DEBUG] ProfileContext cache status:', {
				hasCachedProfile: !!cachedProfile,
				hasCachedStatic: !!cachedStatic,
				hasCachedDynamic: !!cachedDynamic,
				hasCachedSubjects: subjectsCount > 0,
				subjectsCount
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [session?.user?.email, status])

	// Simple fetch with optional retry/backoff for transient failures
	const fetchWithRetry = async (url: string, init: RequestInit, retries: number, backoffMs: number) => {
		try {
			const res = await fetch(url, init)
			if (!res.ok) {
				// Try to parse error body for structured message
				let message = `Request failed with status ${res.status}`
				try {
					const body = await res.json()
					if (body?.error?.message) message = body.error.message
				} catch (_) { }
				throw new Error(message)
			}
			return res
		} catch (err) {
			if (retries > 0) {
				await new Promise(resolve => setTimeout(resolve, backoffMs))
				return fetchWithRetry(url, init, retries - 1, backoffMs * 2)
			}
			throw err
		}
	}

	const fetchBulkData = async (showLoading = true) => {
		if (status !== 'authenticated' || !session?.user?.email) return
		const email = session.user?.email
		if (!email) return

		if (showLoading) setLoading(true)
		setError(null)

		try {
			const stopTimer = PerfMon.startOperation('api:bulk-fetch')
			const response = await fetchWithRetry(
				'/api/bulk-academic-data',
				{ cache: 'no-store' },
				// Retry only when user is waiting (showLoading)
				showLoading ? 2 : 0,
				500
			)
			PerfMon.incrementApiCalls(1)
			if (!response.ok) throw new Error('Failed to fetch data')

			const data = await response.json()
			try {
				const durationMs = stopTimer()
				if (process.env.NODE_ENV !== 'production') {
					// eslint-disable-next-line no-console
					console.log('[PerfMon] bulk-fetch', Math.round(durationMs), 'ms', PerfMon.getSnapshot())
				}
			} catch (_) { }

			// Update state
			setProfile(data.profile)
			setSubjects(Array.isArray(data.subjects) ? data.subjects : [])
			setStaticData((data.static as EnhancedProfileStaticData) ?? null)
			setDynamicData((data.dynamic as EnhancedProfileDynamicData) ?? null)
			setResources(data.resources || null)
			setWarnings(Array.isArray(data.contextWarnings) ? data.contextWarnings : null)

			// Update caches
			ProfileCache.set(email, data.profile)
			try {
				ProfileDisplayCache.set(email, data.profile)
			} catch (err) {
				if (process.env.NODE_ENV !== 'production') {
					// eslint-disable-next-line no-console
					console.warn('ProfileDisplayCache.set failed', { email }, err)
				}
			}
			StaticCache.set(data.static)
			DynamicCache.set(data.dynamic)

			if (
				data.profile?.branch &&
				data.profile?.year &&
				data.profile?.semester
			) {
				SubjectsCache.set(
					data.profile.branch,
					data.profile.year,
					data.profile.semester,
					Array.isArray(data.subjects) ? data.subjects : []
				)
			}

			// Cache resources
			if (data.resources) {
				Object.keys(data.resources).forEach(subject => {
					Object.keys(data.resources[subject]).forEach(category => {
						ResourcesCache.set(category, subject, data.resources[subject][category])
					})
				})
			}

			// Cross-tab broadcast so other tabs can hydrate their session caches/state
			try {
				broadcastBulkCacheUpdate(email, {
					profile: data.profile,
					static: data.static,
					dynamic: data.dynamic,
					subjects: Array.isArray(data.subjects) ? data.subjects : undefined,
					subjectsContext: data.profile?.branch && data.profile?.year && data.profile?.semester
						? { branch: data.profile.branch, year: data.profile.year, semester: data.profile.semester }
						: undefined
				})
			} catch (_) { }
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err)
			setError(message || 'Failed to load data')
			if (process.env.NODE_ENV !== 'production') {
				// eslint-disable-next-line no-console
				console.error('Bulk fetch error:', err)
			}
		} finally {
			setLoading(false)
		}
	}

	// Simple invalidation on user actions
	const refreshProfile = async () => {
		if (!session?.user?.email) return
		ProfileCache.clear()
		try { ProfileDisplayCache.clear() } catch (_) { }
		await fetchBulkData(true)
	}

	const refreshSubjects = async () => {
		if (!profile || !profile.branch || !profile.year || !profile.semester) return
		SubjectsCache.clearForContext(profile.branch, profile.year, profile.semester)
		await fetchBulkData(true)
	}

	const forceRefresh = async () => {
		if (process.env.NODE_ENV !== 'production') {
			console.log('[DEBUG] Force refresh triggered')
		}
		ProfileCache.clear()
		StaticCache.clear()
		DynamicCache.clear()
		try { ProfileDisplayCache.clear() } catch (_) { }
		ResourcesCache.clearAll()
		if (profile && profile.branch && profile.year && profile.semester) {
			SubjectsCache.clearForContext(profile.branch, profile.year, profile.semester)
		}
		await fetchBulkData(true)
	}

	// Refresh dynamic data on tab visibility change if cache expired
	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible' && profile) {
				const cachedDynamic = DynamicCache.get(isEnhancedProfileDynamicData)
				if (!cachedDynamic) {
					fetchBulkData(false).catch((err) => {
						if (process.env.NODE_ENV !== 'production') {
							// eslint-disable-next-line no-console
							console.error('visibilitychange refresh failed:', err)
						}
					})
				}
			}
		}

		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [profile])

	// Cross-tab subscription to hydrate this tab's caches/state without loops
	useEffect(() => {
		if (status !== 'authenticated' || !session?.user?.email) return
		const email = session.user?.email
		if (!email) return

		let mounted = true
		const unsubscribe = subscribeToBulkCacheUpdates((msg) => {
			if (!mounted) return
			if (msg.email !== email) return
			const p = msg.payload
			if (!p) return
			try {
				if (p.profile) {
					ProfileCache.set(email, p.profile)
					if (mounted) {
						setProfile((prev) => p.profile ?? prev)
					}
				}
				if (p.static) {
					StaticCache.set(p.static)
					if (mounted) {
						setStaticData((prev) => p.static ?? prev)
					}
				}
				if (p.dynamic) {
					DynamicCache.set(p.dynamic)
					if (mounted) {
						setDynamicData((prev) => p.dynamic ?? prev)
					}
				}
				if (p.subjects && p.subjectsContext) {
					SubjectsCache.set(p.subjectsContext.branch, p.subjectsContext.year, p.subjectsContext.semester, p.subjects)
					if (mounted) {
						setSubjects((prev) => Array.isArray(p.subjects) ? p.subjects : prev)
					}
				}
			} catch (_) { }
		})

		return () => {
			mounted = false
			unsubscribe()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status, session?.user?.email])

	return (
		<ProfileContext.Provider
			value={{
				profile,
				subjects,
				staticData,
				dynamicData,
				resources,
				loading,
				error,
				warnings,
				refreshProfile,
				refreshSubjects,
				forceRefresh
			}}
		>
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


