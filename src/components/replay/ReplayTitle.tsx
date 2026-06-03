import type { SessionSummary } from '../../lib/api/types'

export default function ReplayTitle({
  summary,
  lapCount,
}: {
  summary: SessionSummary
  lapCount: number
}) {
  return (
    <div className="h-full rounded-2xl border border-zinc-800 bg-surface p-6">
      <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-400">
        REPLAY
      </span>
      <h1 className="mt-4 text-3xl font-bold text-white">{summary.event_name}</h1>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
        <span>{summary.session_name}</span>
        <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
        <span>{summary.location}</span>
        <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
        <span>{lapCount} total laps recorded</span>
      </div>
    </div>
  )
}
