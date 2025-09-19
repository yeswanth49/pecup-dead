'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { ProfileCache, StaticCache, SubjectsCache, DynamicCache } from './simple-cache'

interface Profile {
	id: string
	name: string
	email: string
	roll_number: string
	branch: string | null
	year: number | null
	semester: number | null
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
	staticData: any // TODO: Narrow types once API contract is finalized
	dynamicData: any // TODO: Narrow types once API contract is finalized
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
			// Background refresh without spinner
			fetchBulkData(false).catch(() => {})
		} else {
			// No cache, fetch with spinner
			fetchBulkData(true).catch(() => {})
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [session?.user?.email, status])

	const fetchBulkData = async (showLoading = true) => {
		if (status !== 'authenticated' || !session?.user?.email) return

		if (showLoading) setLoading(true)
		setError(null)

		try {
			const response = await fetch('/api/bulk-academic-data', { cache: 'no-store' })
			if (!response.ok) throw new Error('Failed to fetch data')

			const data = await response.json()

			// Update state
			setProfile(data.profile)
			setSubjects(Array.isArray(data.subjects) ? data.subjects : [])
			setStaticData(data.static ?? null)
			setDynamicData(data.dynamic ?? null)

			// Update caches
			ProfileCache.set(session.user.email, data.profile)
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
		} catch (err: any) {
			setError(err?.message || 'Failed to load data')
			// eslint-disable-next-line no-console
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
		if (!profile || !profile.branch || !profile.year || !profile.semester) return
		SubjectsCache.clearForContext(profile.branch, profile.year, profile.semester)
		await fetchBulkData(true)
	}

	const forceRefresh = async () => {
		ProfileCache.clear()
		StaticCache.clear()
		DynamicCache.clear()
		if (profile && profile.branch && profile.year && profile.semester) {
			SubjectsCache.clearForContext(profile.branch, profile.year, profile.semester)
		}
		await fetchBulkData(true)
	}

	// Refresh dynamic data on tab visibility change if cache expired
	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible' && profile) {
				const cachedDynamic = DynamicCache.get()
				if (!cachedDynamic) {
					fetchBulkData(false).catch(() => {})
				}
			}
		}

		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange)
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [profile])

	return (
		<ProfileContext.Provider
			value={{
				profile,
				subjects,
				staticData,
				dynamicData,
				loading,
				error,
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


