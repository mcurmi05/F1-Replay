import { useCallback, useState } from 'react'
import type { Layout } from 'react-grid-layout'

export function usePersistedLayout(storageKey: string, defaultLayout: Layout) {
  const [saved, setSaved] = useState<Layout | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as Layout
        }
      }
    } catch {
      return null
    }
    return null
  })

  const layout = saved ?? defaultLayout

  const setLayout = useCallback(
    (next: Layout) => {
      setSaved(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        return
      }
    },
    [storageKey],
  )

  const reset = useCallback(() => {
    setSaved(null)
    try {
      localStorage.removeItem(storageKey)
    } catch {
      return
    }
  }, [storageKey])

  return { layout, setLayout, reset }
}
