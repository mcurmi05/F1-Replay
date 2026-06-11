import { useF1Login } from './useF1Login'

// Overlay shown on the live panels whose data is gated behind an F1TV login
// (car positions and telemetry). Free panels render their data as usual; only
// the panels with no data while signed out get covered.
export default function LiveAuthOverlay({ label }: { label: string }) {
  const { working, pending, loginUrl, error, connect } = useF1Login()

  // On a hosted deployment the server holds the F1TV subscription, so a visitor
  // cannot sign in. When the operator's token lapses, show a passive notice
  // rather than a sign-in button the visitor can't action.
  if (__HOSTED__) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#0a0a0f]/70 p-4 text-center backdrop-blur-sm">
        <div className="max-w-xs">
          <p className="text-sm font-semibold text-white">Temporarily unavailable</p>
          <p className="mt-1.5 text-xs text-zinc-400">
            {label} is briefly offline. It will return shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#0a0a0f]/70 p-4 text-center backdrop-blur-sm">
      <div className="max-w-xs">
        <p className="text-sm font-semibold text-white">F1TV sign-in required</p>
        <p className="mt-1.5 text-xs text-zinc-400">
          {label} is only available with an active F1TV Access, Pro, or Premium subscription.
        </p>

        <button
          type="button"
          onClick={connect}
          disabled={working}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-f1-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {working ? 'Opening sign-in...' : pending ? 'Reopen F1TV sign-in' : 'Sign in with F1TV'}
        </button>

        {pending && (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-zinc-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
            Waiting for sign-in...
          </p>
        )}

        {loginUrl && !pending && (
          <p className="mt-3 text-xs text-zinc-500">
            If no tab opened,{' '}
            <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline">
              open the sign-in page
            </a>
            .
          </p>
        )}

        {error && <p className="mt-3 text-xs text-f1-red">{error}</p>}
      </div>
    </div>
  )
}
