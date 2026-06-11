import { useF1Login } from './useF1Login'

// Sign-out entry for the layout burger menu. Renders nothing while signed out
// (the top-bar red button handles signing in); once signed in it lets the user
// drop the F1TV token, which re-locks the auth-gated live panels.
export default function LiveSignOutMenuItem({ onDone }: { onDone: () => void }) {
  const { authenticated, working, disconnect } = useF1Login()

  if (!authenticated) return null

  return (
    <>
      <div className="my-1 h-px bg-zinc-800" />
      <button
        type="button"
        onClick={() => { onDone(); void disconnect() }}
        disabled={working}
        className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
      >
        {working ? 'Signing out...' : 'Sign out of F1TV'}
      </button>
    </>
  )
}
