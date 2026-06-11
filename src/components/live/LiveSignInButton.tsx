import { useF1Login } from './useF1Login'

// Top-bar F1TV sign-in CTA, shown only while signed out so users can unlock the
// gated live panels (car positions, telemetry, standings). Signing out lives in
// the layout burger menu instead.
export default function LiveSignInButton() {
  const { authenticated, working, pending, connect } = useF1Login()

  if (authenticated) return null

  return (
    <>
      <span className="mx-1 h-5 w-px bg-zinc-800" />
      <button
        type="button"
        onClick={connect}
        disabled={working}
        className="inline-flex items-center gap-1.5 rounded-md bg-f1-red px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {working ? 'Opening...' : pending ? 'Reopen F1TV sign-in' : 'Sign in to F1TV'}
      </button>
    </>
  )
}
