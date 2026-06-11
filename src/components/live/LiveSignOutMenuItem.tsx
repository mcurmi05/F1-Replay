import { useF1Login } from './useF1Login'

// Sign-out entry for the layout burger menu. Renders nothing while signed out
// (the top-bar red button handles signing in); once signed in it shows when the
// token expires and lets the user drop it, which re-locks the gated live panels.
// Carries its own divider so the menu has no dangling separator when signed out.
export default function LiveSignOutMenuItem({ onDone }: { onDone: () => void }) {
  const { authenticated, working, expiresAt, disconnect } = useF1Login()

  if (!authenticated) return null

  const expiry = expiresAt && Number.isFinite(Date.parse(expiresAt))
    ? new Date(expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null

  return (
    <>
      <div className="my-1 h-px bg-zinc-800" />
      <button
        type="button"
        onClick={() => { onDone(); void disconnect() }}
        disabled={working}
        className="block w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        <span className="block text-sm font-medium text-zinc-300">
          {working ? 'Signing out...' : 'Sign out of F1TV'}
        </span>
        {expiry && !working ? (
          <span className="block text-[11px] text-zinc-500">Token valid until {expiry}</span>
        ) : null}
      </button>
    </>
  )
}
