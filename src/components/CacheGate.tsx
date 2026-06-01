import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { api } from '../lib/api/client'

export default function CacheGate({ children }: { children: ReactNode }) {
  const [dir, setDir] = useState<string | null | undefined>(undefined)
  const [manualPath, setManualPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getCache()
      .then((result) => setDir(result.dir))
      .catch(() => setDir(null))
  }, [])

  async function apply(folder: string) {
    setBusy(true)
    setError(null)
    try {
      const result = await api.setCache(folder)
      setDir(result.dir)
    } catch {
      setError('Could not use that folder.')
    } finally {
      setBusy(false)
    }
  }

  async function pickWithDialog() {
    setError(null)
    if (!window.desktop) {
      return
    }
    const folder = await window.desktop.chooseFolder()
    if (folder) {
      await apply(folder)
    }
  }

  if (dir === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
      </div>
    )
  }

  if (!dir) {
    const hasDialog = typeof window !== 'undefined' && Boolean(window.desktop)
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-surface p-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-f1-red" />
            F1 Replay
          </span>
          <h1 className="mt-5 text-2xl font-bold text-white">Choose a downloads folder</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Sessions are downloaded and cached here. Pick the same folder next time to reuse what
            you have already downloaded.
          </p>
          {hasDialog ? (
            <button
              type="button"
              onClick={pickWithDialog}
              disabled={busy}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-f1-red px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              Choose folder
            </button>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const value = manualPath.trim()
                if (value) {
                  void apply(value)
                }
              }}
              className="mt-6 space-y-3"
            >
              <input
                value={manualPath}
                onChange={(event) => setManualPath(event.target.value)}
                placeholder="/path/to/folder"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-200 transition focus:border-f1-red focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !manualPath.trim()}
                className="w-full rounded-lg bg-f1-red px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                Use folder
              </button>
            </form>
          )}
          {error ? <p className="mt-3 text-sm text-f1-red">{error}</p> : null}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
