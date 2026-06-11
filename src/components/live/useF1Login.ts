import { useCallback, useEffect, useState } from 'react'

import { api } from '../../lib/api/client'
import type { LiveAuthStatus } from '../../lib/api/types'

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

// Shared F1TV sign-in flow used by both the top-bar button and the per-panel
// overlays. Polls the auth status so the UI reacts once sign-in completes.
export function useF1Login() {
  const [status, setStatus] = useState<LiveAuthStatus | null>(null)
  const [loginUrl, setLoginUrl] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function tick() {
      const controller = new AbortController()
      try {
        const result = await api.liveAuthStatus(controller.signal)
        if (active) setStatus(result)
      } catch {
        /* polled again shortly */
      }
      if (active) timer = setTimeout(tick, 3000)
    }

    tick()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  const connect = useCallback(async () => {
    setWorking(true)
    setError(null)
    try {
      const { url } = await api.liveAuthLogin()
      setLoginUrl(url)
      openExternal(url)
      setStatus(await api.liveAuthStatus())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start sign-in')
    } finally {
      setWorking(false)
    }
  }, [])

  return {
    authenticated: status?.authenticated ?? false,
    pending: status?.pending ?? false,
    loginUrl,
    working,
    error,
    connect,
  }
}
