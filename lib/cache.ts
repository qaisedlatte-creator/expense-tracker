// localStorage cache — gives instant data on every page visit.
// Supabase syncs in the background; the cache is always the source of truth for rendering.

const PREFIX = 'webbes:'

export const cache = {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // Storage full — ignore
    }
  },

  del(key: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(PREFIX + key)
  },
}

// Initialise React state from cache — zero-flash on revisit
export function fromCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  return cache.get<T>(key) ?? fallback
}
