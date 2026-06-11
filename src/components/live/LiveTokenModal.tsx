import { useState } from 'react'
import { createPortal } from 'react-dom'

import { api } from '../../lib/api/client'

// Bookmarklet the user runs while logged in at f1tv.com. It pulls the F1TV
// subscriptionToken out of the login-session cookie (falling back to a JWT in
// web storage that carries the subscription claims) and copies it to the
// clipboard, so it can be pasted back here. Backslashes are doubled because this
// lives in a JS string; the copied text contains single backslashes.
const BOOKMARKLET = `javascript:(function(){function d(j){try{var p=j.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';return JSON.parse(atob(p))}catch(e){return null}}var t=null,m=document.cookie.match(/(?:^|;\\s*)login-session=([^;]+)/);if(m){try{var c=JSON.parse(decodeURIComponent(m[1]));t=c&&c.data&&c.data.subscriptionToken}catch(e){}}if(!t){var S=[localStorage,sessionStorage];for(var i=0;i<S.length&&!t;i++){for(var k=0;k<S[i].length;k++){var v=S[i].getItem(S[i].key(k))||'';var mm=v.match(/eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+/);if(mm){var pl=d(mm[0]);if(pl&&(pl.SubscriptionStatus||pl.SubscribedProduct)){t=mm[0];break}}}}}if(!t){alert('No F1TV token found. Make sure you are logged in at f1tv.com, or use the FastF1 Companion extension.');return}function f(){window.prompt('F1TV token - copy this, then paste it into F1 Replay:',t)}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){alert('F1TV token copied! Switch back to F1 Replay and paste it.')},f)}else{f()}})();`

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleString()
}

// Temporary mobile fix for F1TV auth. On a hosted/mobile deployment the browser
// add-on can't reach the backend on localhost, so a token captured from f1tv.com
// (via the bookmarklet below) is pasted here and stored via POST
// /api/live/auth/token to unlock car positions, telemetry and standings. The
// intended long-term replacement is a browser extension that POSTs automatically.
export default function LiveTokenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expiry, setExpiry] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  async function submit() {
    const token = value.trim()
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const status = await api.liveAuthSetToken(token)
      setExpiry(formatExpiry(status.expires_at))
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set token.')
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

  function close() {
    setError(null)
    setExpiry(null)
    setValue('')
    setShowHelp(false)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={close}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-800 bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">F1TV token</h2>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            Temporary mobile fix
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
          Paste an F1TV subscription token to unlock the track map, telemetry and standings. Tokens
          last about four days. A browser extension will replace this manual step later.
        </p>

        {expiry ? (
          <div className="mt-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">
            Token accepted - valid until {expiry}.
          </div>
        ) : (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="eyJ..."
            rows={4}
            className="mt-4 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 font-mono text-xs text-zinc-200 focus:border-f1-red focus:outline-none"
          />
        )}
        {error ? <p className="mt-2 text-xs text-f1-red">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
          >
            {expiry ? 'Done' : 'Cancel'}
          </button>
          {expiry ? null : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !value.trim()}
              className="rounded-lg bg-f1-red px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Setting...' : 'Set token'}
            </button>
          )}
        </div>

        {expiry ? null : (
          <div className="mt-5 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-zinc-300 hover:text-white"
            >
              How do I get my token?
              <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${showHelp ? 'rotate-180' : ''}`} fill="currentColor">
                <path d="M6 8L1 3h10z" />
              </svg>
            </button>
            {showHelp ? (
              <div className="mt-3 space-y-3 text-xs leading-relaxed text-zinc-400">
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Open <span className="font-mono text-zinc-300">f1tv.com</span> in your browser and log in.</li>
                  <li>Run the bookmarklet below on that page - it copies your token.</li>
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
                <p>
                  Save it as a bookmark (on Firefox Android: bookmark any page, edit it, and replace the
                  address with this code), then run it from the address bar while on f1tv.com. If it
                  reports it can't find the token, install the <span className="text-zinc-300">FastF1 Companion</span> extension and use that instead.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
