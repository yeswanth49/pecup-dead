'use client'

// Security-minded caches with SSR guards and safe fallbacks

export interface CachedProfile {
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

export class ProfileCache {
  private static KEY = 'profile_cache'

  // Only store a safe subset of profile fields to avoid accidental PII bloat
  private static whitelistProfile(profile: any) {
    if (!profile || typeof profile !== 'object') return null
    const {
      id,
      name,
      email,
      roll_number,
      branch,
      year,
      semester,
      section,
      role
    } = profile
    return { id, name, email, roll_number, branch, year, semester, section, role }
  }

  static set(email: string, profile: CachedProfile) {
    if (typeof window === 'undefined') return
    try {
      const safeProfile = this.whitelistProfile(profile)
      if (!safeProfile) {
        // If we cannot serialize safely, clear to avoid stale/invalid entries
        this.clear()
        return
      }
      sessionStorage.setItem(
        this.KEY,
        JSON.stringify({ email, profile: safeProfile, timestamp: Date.now() })
      )
    } catch (e) {
      console.warn('Failed to cache profile:', e)
    }
  }

  static get(email: string): CachedProfile | null {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem(this.KEY)
      if (!cached) return null

      const { email: cachedEmail, profile } = JSON.parse(cached) as { email?: string; profile?: CachedProfile }

      if (!cachedEmail || cachedEmail !== email) {
        // Different user or invalid structure -> clear
        this.clear()
        return null
      }

      return (profile as CachedProfile) || null
    } catch (e) {
      console.warn('Failed to read profile cache:', e)
      this.clear()
      return null
    }
  }

  static clear() {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem(this.KEY)
    } catch (_) {}
  }
}

export class StaticCache {
  private static KEY = 'static_data_cache'
  private static TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

  static set(data: unknown) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(
        this.KEY,
        JSON.stringify({ data, timestamp: Date.now(), expiresAt: Date.now() + this.TTL })
      )
    } catch (e) {
      // Handle quota exceeded: try remove existing entry and retry once
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || (e as any).code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        try {
          localStorage.removeItem(this.KEY)
          localStorage.setItem(
            this.KEY,
            JSON.stringify({ data, timestamp: Date.now(), expiresAt: Date.now() + this.TTL })
          )
        } catch (retryErr) {
          console.warn('StaticCache: quota exceeded; skipping cache write after retry:', retryErr)
        }
      } else {
        console.warn('Failed to cache static data:', e)
      }
    }
  }

  static get<T = unknown>(): T | null {
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem(this.KEY)
      if (!cached) return null

      const { data, expiresAt } = JSON.parse(cached) as { data: unknown; expiresAt?: number }
      if (!expiresAt || Date.now() > expiresAt) {
        this.clear()
        return null
      }

      return (data as T) ?? null
    } catch (e) {
      console.warn('Failed to read static cache:', e)
      this.clear()
      return null
    }
  }

  static clear() {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(this.KEY)
    } catch (_) {}
  }
}

export class SubjectsCache {
  private static getKey(branch: string, year: number, semester: number) {
    return `subjects_${branch}_${year}_${semester}`
  }

  static set(branch: string, year: number, semester: number, subjects: Array<{ id: string; code: string; name: string; resource_type?: string }>) {
    if (typeof window === 'undefined') return
    try {
      const key = this.getKey(branch, year, semester)
      localStorage.setItem(
        key,
        JSON.stringify({ subjects, timestamp: Date.now(), context: { branch, year, semester } })
      )
    } catch (e) {
      console.warn('Failed to cache subjects:', e)
    }
  }

  static get(branch: string, year: number, semester: number): Array<{ id: string; code: string; name: string; resource_type?: string }> | null {
    if (typeof window === 'undefined') return null
    try {
      const key = this.getKey(branch, year, semester)
      const cached = localStorage.getItem(key)
      if (!cached) return null

      const { subjects, context } = JSON.parse(cached) as { subjects: Array<{ id: string; code: string; name: string; resource_type?: string }>; context?: { branch: string; year: number; semester: number } }
      if (!context || context.branch !== branch || context.year !== year || context.semester !== semester) {
        localStorage.removeItem(key)
        return null
      }

      return (subjects as Array<{ id: string; code: string; name: string; resource_type?: string }>) ?? null
    } catch (e) {
      console.warn('Failed to read subjects cache:', e)
      return null
    }
  }

  static clearForContext(branch: string, year: number, semester: number) {
    if (typeof window === 'undefined') return
    try {
      const key = this.getKey(branch, year, semester)
      localStorage.removeItem(key)
    } catch (_) {}
  }

  static clearAll() {
    if (typeof window === 'undefined') return
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('subjects_'))
      for (const key of keys) {
        try { localStorage.removeItem(key) } catch (_) {}
      }
    } catch (_) {}
  }
}

export class DynamicCache {
  private static KEY = 'dynamic_data_cache'
  private static TTL = 10 * 60 * 1000 // 10 minutes

  static set(data: unknown) {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(
        this.KEY,
        JSON.stringify({ data, timestamp: Date.now(), expiresAt: Date.now() + this.TTL })
      )
    } catch (e) {
      // Handle quota exceeded for sessionStorage
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || (e as any).code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        try {
          sessionStorage.removeItem(this.KEY)
          sessionStorage.setItem(
            this.KEY,
            JSON.stringify({ data, timestamp: Date.now(), expiresAt: Date.now() + this.TTL })
          )
        } catch (retryErr) {
          console.warn('DynamicCache: quota exceeded; skipping cache write after retry:', retryErr)
        }
      } else {
        console.warn('Failed to cache dynamic data:', e)
      }
    }
  }

  static get<T = unknown>(): T | null {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem(this.KEY)
      if (!cached) return null

      const { data, expiresAt } = JSON.parse(cached) as { data: unknown; expiresAt?: number }
      if (!expiresAt || Date.now() > expiresAt) {
        this.clear()
        return null
      }

      return (data as T) ?? null
    } catch (e) {
      console.warn('Failed to read dynamic cache:', e)
      this.clear()
      return null
    }
  }

  static clear() {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem(this.KEY)
    } catch (_) {}
  }
}


