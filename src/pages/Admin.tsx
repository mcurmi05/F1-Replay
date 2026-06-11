import { useState } from 'react'

import { getAdminToken, setAdminToken } from '../lib/api/admin'
import { api } from '../lib/api/client'
import { BOOKMARKLET } from '../lib/f1tvBookmarklet'
import { useF1Login } from '../components/live/useF1Login'

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleString()
}

// Operator console for a hosted deployment. Gated by the admin secret (stored
// on the operator's own device and sent as X-Admin-Token), it sets or clears
// the single F1TV token the server uses to serve car positions, telemetry and
// standings to every visitor. Not linked from the public UI.
export default function Admin() {
  const { authenticated, expiresAt, working, disconnect } = useF1Login()
  const [admin, setAdmin] = useState(() => getAdminToken())
  const [adminInput, setAdminInput] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okExpiry, setOkExpiry] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)

  function unlock() {
    const value = adminInput.trim()
    if (!value) return
    setAdminToken(value)
    setAdmin(value)
    setAdminInput('')
    setError(null)
  }

  function lock() {
    setAdminToken('')
    setAdmin('')
    setOkExpiry(null)
  }

  async function submit() {
    const value = token.trim()
    if (!value) return
    setBusy(true)
    setError(null)
    setOkExpiry(null)
    try {
      const status = await api.liveAuthSetToken(value)
      setOkExpiry(formatExpiry(status.expires_at))
      setToken('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not set token.'
      setError(message)
      if (/admin/i.test(message)) lock()
    } finally {
      setBusy(false)
    }
  }

  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy - select the code and copy it manually.')
    }
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-surface p-6">
          <h1 className="text-lg font-bold text-white">Operator access</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Enter the admin token to manage the server F1TV credentials.
          </p>
          <input
            type="password"
            autoFocus
            value={adminInput}
            onChange={(e) => setAdminInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') unlock() }}
            placeholder="Admin token"
            className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-200 focus:border-f1-red focus:outline-none"
          />
          <button
            type="button"
            onClick={unlock}
            disabled={!adminInput.trim()}
            className="mt-4 w-full rounded-lg bg-f1-red px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#0a0a0f] px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-surface p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">F1TV server token</h1>
          <button
            type="button"
            onClick={lock}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
          >
            Lock
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
          {authenticated ? (
            <p className="text-emerald-300">
              Server signed in
              {expiresAt && formatExpiry(expiresAt) ? (
                <span className="text-zinc-400"> - valid until {formatExpiry(expiresAt)}</span>
              ) : null}
            </p>
          ) : (
            <p className="text-zinc-400">Server is not signed in. Set a token below.</p>
          )}
        </div>

        {okExpiry ? (
          <div className="mt-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">
            Token accepted - valid until {okExpiry}.
          </div>
        ) : (
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJ..."
            rows={4}
            className="mt-4 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 font-mono text-xs text-zinc-200 focus:border-f1-red focus:outline-none"
          />
        )}
        {error ? <p className="mt-2 text-xs text-f1-red">{error}</p> : null}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !token.trim()}
            className="flex-1 rounded-lg bg-f1-red px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Setting...' : 'Set token'}
          </button>
          {authenticated ? (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={working}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
            >
              {working ? 'Signing out...' : 'Sign out'}
            </button>
          ) : null}
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm font-medium text-zinc-300 hover:text-white"
          >
            How do I get a token?
            <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${showHelp ? 'rotate-180' : ''}`} fill="currentColor">
              <path d="M6 8L1 3h10z" />
            </svg>
          </button>
          {showHelp ? (
            <div className="mt-3 space-y-3 text-xs leading-relaxed text-zinc-400">
              <ol className="list-decimal space-y-1 pl-4">
                <li>Open <span className="font-mono text-zinc-300">f1tv.com</span> and log in.</li>
                <li>Run the bookmarklet below on that page to copy your token.</li>
                <li>Come back here and paste it above.</li>
              </ol>
              <textarea
                readOnly
                value={BOOKMARKLET}
                rows={3}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-2 font-mono text-[10px] text-zinc-400 focus:border-zinc-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void copyBookmarklet()}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
              >
                {copied ? 'Copied!' : 'Copy bookmarklet'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
