import { useCallback, useEffect, useState } from 'react'

import { api } from '../../lib/api/client'
import type { LiveAuthStatus, LiveNextSession } from '../../lib/api/types'

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function LiveAuthGate({ next }: { next: LiveNextSession | null }) {
  const [status, setStatus] = useState<LiveAuthStatus | null>(null)
  const [loginUrl, setLoginUrl] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api.liveAuthStatus(signal)
      setStatus(result)
    } catch {
      /* polled again shortly */
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    refresh(controller.signal)
    const id = setInterval(() => refresh(), 3000)
    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [refresh])

  const connect = useCallback(async () => {
    setWorking(true)
    setError(null)
    try {
      const { url } = await api.liveAuthLogin()
      setLoginUrl(url)
      openExternal(url)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start sign-in')
    } finally {
      setWorking(false)
    }
  }, [refresh])

  const pending = status?.pending ?? false

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-surface p-8 text-center">
        <h1 className="text-2xl font-bold text-white">Connect your F1TV account</h1>
        <p className="mt-3 text-zinc-400">
          {next?.session_name
            ? `${next.event_name ?? 'The next session'} - ${next.session_name} is in its live window.`
            : 'A session is in its live window.'}{' '}
          Live timing from F1 requires an active F1TV Access, Pro, or Premium subscription.
        </p>

        <button
          type="button"
          onClick={connect}
          disabled={working}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-f1-red px-5 py-2.5 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {working ? 'Opening sign-in...' : pending ? 'Reopen F1TV sign-in' : 'Sign in with F1TV'}
        </button>

        {loginUrl && (
          <p className="mt-4 text-sm text-zinc-500">
            If a browser tab did not open,{' '}
            <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline">
              open the sign-in page
            </a>
            . A FastF1 browser add-on is required; the page offers it if it is missing.
          </p>
        )}

        {pending && !status?.authenticated && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
            Waiting for sign-in to complete...
          </p>
        )}

        {error && <p className="mt-4 text-sm text-f1-red">{error}</p>}

        <p className="mt-6 text-xs text-zinc-600">
          Authentication is handled by FastF1 and stored locally on this machine. The timing feed starts
          automatically once you are signed in.
        </p>
      </div>
    </div>
  )
}
