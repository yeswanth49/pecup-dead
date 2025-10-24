// Security-minded caches with SSR guards and safe fallbacks

interface Resource {
  id?: string
  name: string
  description?: string
  date: string
  type: string
  url: string
  unit?: number
}

// Type-guard function to validate CachedProfile shape and types
function isCachedProfile(obj: unknown): obj is CachedProfile {
  if (!obj || typeof obj !== 'object') return false

  const o = obj as Record<string, unknown>

  // Required fields
  if (typeof o.id !== 'string') return false
  if (typeof o.email !== 'string') return false

  // Optional fields type validation
  if (o.name != null && typeof o.name !== 'string') return false
  if (o.roll_number != null && typeof o.roll_number !== 'string') return false
  if (o.branch != null && typeof o.branch !== 'string') return false
  if (o.year != null && typeof o.year !== 'number') return false
  if (o.semester != null && typeof o.semester !== 'number') return false
  if (o.section != null && typeof o.section !== 'string') return false
  if (o.role != null && typeof o.role !== 'string') return false

  return true
}

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

// Helper function for quota detection
function isQuotaExceeded(e: unknown): boolean {
  return e instanceof DOMException && (
    e.name === 'QuotaExceededError' ||
    (e as any).code === 22 ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  )
}

export class ProfileCache {
  public static readonly KEY = 'profile_cache'

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

      const { email: cachedEmail, profile } = JSON.parse(cached) as { email?: string; profile?: unknown }

      if (!cachedEmail || cachedEmail !== email) {
        // Different user or invalid structure -> clear
        this.clear()
        return null
      }

      if (!isCachedProfile(profile)) {
        console.warn('Invalid profile structure in cache')
        this.clear()
        return null
      }

      return profile
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
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG] ProfileCache cleared')
      }
    } catch (_) {}
  }
}

export class StaticCache {
  public static readonly KEY = 'static_data_cache'
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
      if (isQuotaExceeded(e)) {
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

  // Overload signatures for type-safe cache access
  static get(): unknown | null
  static get<T>(validator: (d: unknown) => d is T): T | null
  static get<T>(validator?: (d: unknown) => d is T): unknown | T | null {
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem(this.KEY)
      if (!cached) return null

      const { data, expiresAt } = JSON.parse(cached) as { data: unknown; expiresAt?: number }
      if (!expiresAt || Date.now() > expiresAt) {
        this.clear()
        return null
      }

      if (validator) {
        if (!validator(data)) {
          console.warn('StaticCache: cached data failed validation')
          this.clear()
          return null
        }
        return data as T
      } else {
        // No validator provided - return as unknown and warn in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('StaticCache.get() called without validator - data returned as unknown. Consider providing a validator for type safety.')
        }
        return data ?? null
      }
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
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG] StaticCache cleared')
      }
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
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ subjects, timestamp: Date.now(), context: { branch, year, semester } })
        )
      } catch (e) {
        if (isQuotaExceeded(e)) {
          try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('subjects_'))
            // Sort by timestamp, remove oldest first
            const entries = keys.map(k => {
              try {
                const item = JSON.parse(localStorage.getItem(k) || '{}')
                return { key: k, timestamp: item.timestamp || 0 }
              } catch { return { key: k, timestamp: 0 } }
            }).sort((a, b) => a.timestamp - b.timestamp)

            // Remove oldest entries one at a time until we have space or run out of old entries
            const toRemove = Math.min(3, Math.ceil(entries.length / 4))
            for (let i = 0; i < toRemove; i++) {
              try { localStorage.removeItem(entries[i].key) } catch (_) {}
            }

            try {
              localStorage.setItem(
                key,
                JSON.stringify({ subjects, timestamp: Date.now(), context: { branch, year, semester } })
              )
            } catch (retryErr) {
              if (!isQuotaExceeded(retryErr)) throw retryErr
              // If still quota exceeded, try more aggressive cleanup
              const additionalToRemove = Math.min(5, Math.ceil(entries.length / 3))
              for (let i = toRemove; i < toRemove + additionalToRemove && i < entries.length; i++) {
                try { localStorage.removeItem(entries[i].key) } catch (_) {}
              }
              localStorage.setItem(
                key,
                JSON.stringify({ subjects, timestamp: Date.now(), context: { branch, year, semester } })
              )
            }
          } catch (retryErr) {
            console.warn('SubjectsCache: quota exceeded; skipping cache write after cleanup:', retryErr)
          }
        } else {
          console.warn('Failed to cache subjects:', e)
        }
      }
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

      const parsed = JSON.parse(cached) as { subjects?: Array<{ id: string; code: string; name: string; resource_type?: string }>; context?: { branch: string; year: number; semester: number } }
      const subjects = Array.isArray(parsed?.subjects) ? parsed.subjects : null
      const context = parsed?.context
      if (!context || context.branch !== branch || context.year !== year || context.semester !== semester) {
        localStorage.removeItem(key)
        return null
      }

      return subjects ?? null
    } catch (e) {
      console.warn('Failed to read subjects cache:', e)
      try { localStorage.removeItem(this.getKey(branch, year, semester)) } catch (_) {}
      return null
    }
  }

  static clearForContext(branch: string, year: number, semester: number) {
    if (typeof window === 'undefined') return
    try {
      const key = this.getKey(branch, year, semester)
      localStorage.removeItem(key)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] SubjectsCache cleared for context: ${branch}_${year}_${semester}`)
      }
    } catch (_) {}
  }

  static clearAll() {
    if (typeof window === 'undefined') return
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('subjects_'))
      for (const key of keys) {
        try { localStorage.removeItem(key) } catch (_) {}
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] SubjectsCache cleared all (${keys.length} keys)`)
      }
    } catch (_) {}
  }
}

export class ResourcesCache {
  private static readonly TTL = 3 * 24 * 60 * 60 * 1000 // 3 days in milliseconds

  private static getKey(category: string, subject: string, year?: string, semester?: string, branch?: string) {
    return `resources_${category}_${subject}_${year || 'none'}_${semester || 'none'}_${branch || 'none'}`
  }

  static set(category: string, subject: string, resources: Resource[], year?: string, semester?: string, branch?: string) {
    if (typeof window === 'undefined') return
    const key = this.getKey(category, subject, year, semester, branch)
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ resources, timestamp: Date.now(), context: { category, subject, year, semester, branch } })
      )
    } catch (e) {
      if (isQuotaExceeded(e)) {
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('resources_'))
          const entries = keys.map(k => {
            try {
              const item = JSON.parse(localStorage.getItem(k) || '{}')
              return { key: k, timestamp: item.timestamp || 0 }
            } catch { return { key: k, timestamp: 0 } }
          }).sort((a, b) => a.timestamp - b.timestamp)

          const toRemove = Math.min(3, Math.ceil(entries.length / 4))
          for (let i = 0; i < toRemove; i++) {
            try { localStorage.removeItem(entries[i].key) } catch (_) {}
          }

          try {
            localStorage.setItem(
              key,
              JSON.stringify({ resources, timestamp: Date.now(), context: { category, subject, year, semester, branch } })
            )
          } catch (retryErr) {
            console.warn('ResourcesCache: quota exceeded; skipping cache write after cleanup:', retryErr)
          }
        } catch (_) {}
      } else {
        console.warn('Failed to cache resources:', e)
      }
    }
  }

  static get(category: string, subject: string, year?: string, semester?: string, branch?: string): Resource[] | null {
    if (typeof window === 'undefined') return null
    try {
      const key = this.getKey(category, subject, year, semester, branch)
      const cached = localStorage.getItem(key)
      if (!cached) return null

      const parsed = JSON.parse(cached) as { resources?: Resource[]; context?: { category: string; subject: string; year?: string; semester?: string; branch?: string }; timestamp?: number }
      const resources = Array.isArray(parsed?.resources) ? parsed.resources : null
      const context = parsed?.context
      const timestamp = parsed?.timestamp

      // Check TTL
      if (timestamp && Date.now() - timestamp > this.TTL) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEBUG] ResourcesCache expired for key: ${key}, age: ${Date.now() - timestamp} ms`)
        }
        localStorage.removeItem(key)
        return null
      }

      if (!context || context.category !== category || context.subject !== subject || context.year !== year || context.semester !== semester || context.branch !== branch) {
        localStorage.removeItem(key)
        return null
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] ResourcesCache hit for key: ${key}, count: ${resources?.length || 0}`)
      }

      return resources ?? null
    } catch (e) {
      console.warn('Failed to read resources cache:', e)
      try { localStorage.removeItem(this.getKey(category, subject, year, semester, branch)) } catch (_) {}
      return null
    }
  }

  static clearForSubject(category: string, subject: string) {
    if (typeof window === 'undefined') return
    try {
      const prefix = `resources_${category}_${subject}_`
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix))
      for (const key of keys) {
        try { localStorage.removeItem(key) } catch (_) {}
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] ResourcesCache cleared for ${category}_${subject} (${keys.length} keys)`)
      }
    } catch (_) {}
  }
 
  static clearAll() {
    if (typeof window === 'undefined') return
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('resources_'))
      for (const key of keys) {
        try { localStorage.removeItem(key) } catch (_) {}
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] ResourcesCache cleared all (${keys.length} keys)`)
      }
    } catch (_) {}
  }
}

export class DynamicCache {
  public static readonly KEY = 'dynamic_data_cache'
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
      if (isQuotaExceeded(e)) {
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

  // Overload signatures for type-safe cache access
  static get(): unknown | null
  static get<T>(validator: (d: unknown) => d is T): T | null
  static get<T>(validator?: (d: unknown) => d is T): unknown | T | null {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem(this.KEY)
      if (!cached) return null

      const { data, expiresAt } = JSON.parse(cached) as { data: unknown; expiresAt?: number }
      if (!expiresAt || Date.now() > expiresAt) {
        this.clear()
        return null
      }

      if (validator) {
        if (!validator(data)) {
          console.warn('DynamicCache: cached data failed validation')
          this.clear()
          return null
        }
        return data as T
      } else {
        // No validator provided - return as unknown and warn in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('DynamicCache.get() called without validator - data returned as unknown. Consider providing a validator for type safety.')
        }
        return data ?? null
      }
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
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG] DynamicCache cleared')
      }
    } catch (_) {}
  }
}


// Minimal, persistent display cache to avoid UI flicker across sessions
export interface CachedProfileDisplay {
  name?: string
  branch?: string | null
  year?: number | null
  semester?: number | null
}

export class ProfileDisplayCache {
  private static KEY = 'profile_display_cache'
  private static TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

  private static whitelistDisplay(profile: any): CachedProfileDisplay | null {
    if (!profile || typeof profile !== 'object') return null
    const { name, branch, year, semester } = profile
    return { name, branch, year, semester }
  }

  static set(email: string, profile: any) {
    if (typeof window === 'undefined') return
    try {
      const display = this.whitelistDisplay(profile)
      if (!display) {
        this.clear()
        return
      }
      localStorage.setItem(
        this.KEY,
        JSON.stringify({ email, profile: display, timestamp: Date.now(), expiresAt: Date.now() + this.TTL })
      )
    } catch (e) {
      // best-effort, ignore quota errors
      try { localStorage.removeItem(this.KEY) } catch (_) {}
    }
  }

  static get(email: string): CachedProfileDisplay | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(this.KEY)
      if (!raw) return null
      const { email: cachedEmail, profile, expiresAt } = JSON.parse(raw) as { email?: string; profile?: CachedProfileDisplay; expiresAt?: number }
      if (!cachedEmail || cachedEmail !== email || !expiresAt || Date.now() > expiresAt) {
        this.clear()
        return null
      }
      return profile || null
    } catch {
      this.clear()
      return null
    }
  }

  // Non-strict read for initial paint before session is available. Respects TTL.
  static peek(): CachedProfileDisplay | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(this.KEY)
      if (!raw) return null
      const { profile, expiresAt } = JSON.parse(raw) as { profile?: CachedProfileDisplay; expiresAt?: number }
      if (!expiresAt || Date.now() > expiresAt) {
        this.clear()
        return null
      }
      return profile || null
    } catch {
      this.clear()
      return null
    }
  }

  static clear() {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(this.KEY)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG] ProfileDisplayCache cleared')
      }
    } catch (_) {}
  }
}


