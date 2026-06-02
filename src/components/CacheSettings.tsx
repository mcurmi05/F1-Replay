import { useEffect, useState } from 'react'

import { api } from '../lib/api/client'
import { FolderIcon } from './icons'

export default function CacheSettings() {
  const [dir, setDir] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [manualPath, setManualPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasDialog = typeof window !== 'undefined' && Boolean(window.desktop)

  useEffect(() => {
    api
      .getCache()
      .then((result) => setDir(result.dir))
      .catch(() => undefined)
  }, [])

  function openModal() {
    setError(null)
    setPending(null)
    setManualPath('')
    setOpen(true)
    api
      .getCache()
      .then((result) => setDir(result.dir))
      .catch(() => undefined)
  }

  function closeModal() {
    if (busy) {
      return
    }
    setOpen(false)
    setPending(null)
    setError(null)
  }

  function choose(folder: string) {
    const next = folder.trim()
    if (!next) {
      return
    }
    if (next === dir) {
      closeModal()
      return
    }
    if (dir) {
      setPending(next)
    } else {
      void apply(next, false)
    }
  }

  async function pickWithDialog() {
    setError(null)
    if (!window.desktop) {
      return
    }
    const folder = await window.desktop.chooseFolder()
    if (folder) {
      choose(folder)
    }
  }

  async function apply(folder: string, deletePrevious: boolean) {
    setBusy(true)
    setError(null)
    try {
      const result = await api.setCache(folder, deletePrevious)
      setDir(result.dir)
      setOpen(false)
      setPending(null)
    } catch {
      setError('Could not use that folder.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title={dir ?? 'No cache folder selected'}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
      >
        <FolderIcon className="h-4 w-4" />
        Cache
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-surface p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {pending ? (
              <>
                <h2 className="text-lg font-bold text-white">Delete the previous folder?</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Your downloads will move to:
                </p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-300">{pending}</p>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  Do you want to permanently delete the folder you used before?
                </p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-300">{dir}</p>
                {error ? <p className="mt-3 text-sm text-f1-red">{error}</p> : null}
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => apply(pending, false)}
                    disabled={busy}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => apply(pending, true)}
                    disabled={busy}
                    className="rounded-lg bg-f1-red px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    Delete it
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-white">Cache folder</h2>
                <p className="mt-3 text-sm text-zinc-400">Sessions are downloaded and cached here.</p>
                <p className="mt-2 break-all font-mono text-xs text-zinc-300">
                  {dir ?? 'No folder selected yet.'}
                </p>
                {hasDialog ? (
                  <button
                    type="button"
                    onClick={pickWithDialog}
                    disabled={busy}
                    className="mt-6 w-full rounded-lg bg-f1-red px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    Change folder
                  </button>
                ) : (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      choose(manualPath)
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
                      Change folder
                    </button>
                  </form>
                )}
                {error ? <p className="mt-3 text-sm text-f1-red">{error}</p> : null}
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-3 w-full rounded-lg px-5 py-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-300"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
