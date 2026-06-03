import { useCallback, useState } from 'react'
import type { Layout } from 'react-grid-layout'

export function usePersistedLayout(storageKey: string, defaultLayout: Layout) {
  const [layout, setLayoutState] = useState<Layout>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as Layout
        }
      }
    } catch {
      return defaultLayout
    }
    return defaultLayout
  })

  const setLayout = useCallback(
    (next: Layout) => {
      setLayoutState(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        return
      }
    },
    [storageKey],
  )

  const reset = useCallback(() => {
    setLayoutState(defaultLayout)
    try {
      localStorage.removeItem(storageKey)
    } catch {
      return
    }
  }, [storageKey, defaultLayout])

  return { layout, setLayout, reset }
}
