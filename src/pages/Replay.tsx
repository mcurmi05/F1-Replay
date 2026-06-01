import { Link, useParams } from 'react-router-dom'
import { ArrowRightIcon } from '../components/icons'

export default function Replay() {
  const { sessionKey } = useParams<{ sessionKey: string }>()

  return (
    <div className="space-y-6">
      <Link
        to="/home"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowRightIcon className="h-4 w-4 rotate-180" />
        Back to home
      </Link>

      <div className="rounded-2xl border border-zinc-800 bg-surface p-8">
        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-400">
          REPLAY
        </span>
        <h1 className="mt-4 text-3xl font-bold text-white">
          Session {sessionKey}
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-zinc-400">
          Track map, timing tower (lap and sector times, tyre compound, driver
          name and number) and telemetry for session{' '}
          <span className="font-mono text-zinc-300">{sessionKey}</span>.
        </p>
      </div>
    </div>
  )
}
