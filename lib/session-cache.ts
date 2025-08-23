'use client'

import { useEffect, useRef, useState } from 'react'

const SESSION_CACHE_PREFIX = 'session_cache_v1'

export function useSessionCachedResource<T>(key: string, fetcher: () => Promise<T>, deps: any[] = []) {
  const storageKey = `${SESSION_CACHE_PREFIX}:${key}`
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  // Load from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        setData(parsed.value)
        hasFetched.current = true
      }
    } catch (err) {
      console.warn('Failed to read session cache for', storageKey, err)
      try { sessionStorage.removeItem(storageKey) } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Storage event handler for cross-tab sync
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onStorage(e: StorageEvent) {
      if (e.key !== storageKey) return
      try {
        if (!e.newValue) {
          setData(null)
          return
        }
        const parsed = JSON.parse(e.newValue)
        setData(parsed.value)
      } catch (err) {
        console.warn('Failed to parse storage event for', storageKey, err)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  const revalidate = async (force = false) => {
    if (typeof window === 'undefined') return
    // If we've already fetched and not forcing, skip
    if (!force && hasFetched.current) return
    setLoading(true)
    setError(null)
    try {
      const fetched = await fetcher()
      setData(fetched as T)
      hasFetched.current = true
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ value: fetched, lastUpdated: Date.now() }))
      } catch (err) {
        console.warn('Failed to write session cache for', storageKey, err)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // Initial background fetch on mount and also when deps change
  useEffect(() => {
    // Always kick off background revalidation (stale-while-revalidate)
    revalidate(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Revalidate on window focus
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onFocus = () => {
      revalidate(true)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [storageKey, ...deps])

  const refresh = async () => {
    // force a fresh fetch and overwrite cache
    try { sessionStorage.removeItem(storageKey) } catch (_) {}
    hasFetched.current = false
    await revalidate(true)
  }

  return { data, loading, error, refresh }
}


