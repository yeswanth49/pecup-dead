"use client";

import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      console.log(`[useLocalStorage] Loading from localStorage key "${key}":`, raw);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        console.log(`[useLocalStorage] Parsed value for "${key}":`, parsed);
        setState(parsed);
      } else {
        console.log(`[useLocalStorage] No value found for "${key}", using initialValue:`, initialValue);
      }
    } catch (error) {
      console.error(`[useLocalStorage] Error parsing localStorage for "${key}":`, error);
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try {
      console.log(`[useLocalStorage] Saving to localStorage key "${key}":`, state);
      window.localStorage.setItem(key, JSON.stringify(state));
      console.log(`[useLocalStorage] Successfully saved to localStorage for "${key}"`);
    } catch (error) {
      console.error(`[useLocalStorage] Error saving to localStorage for "${key}":`, error);
      // ignore
    }
  }, [key, state]);

  return [state, setState] as const;
}


