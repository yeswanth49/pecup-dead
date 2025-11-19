"use client";

import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[useLocalStorage] Loading from localStorage key "${key}":`, raw);
      }
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[useLocalStorage] Parsed value for "${key}":`, parsed);
        }
        setState(parsed);
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[useLocalStorage] No value found for "${key}", using initialValue:`, initialValue);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[useLocalStorage] Error parsing localStorage for "${key}":`, error);
      }
      // ignore
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[useLocalStorage] Saving to localStorage key "${key}":`, state);
      }
      window.localStorage.setItem(key, JSON.stringify(state));
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[useLocalStorage] Successfully saved to localStorage for "${key}"`);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[useLocalStorage] Error saving to localStorage for "${key}":`, error);
      }
      // ignore
    }
  }, [key, state, loaded]);

  return [state, setState] as const;
}


