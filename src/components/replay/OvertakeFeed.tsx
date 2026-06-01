import type { OvertakeEvent } from '../../lib/replay'

export default function OvertakeFeed({
  events,
  currentTime,
}: {
  events: OvertakeEvent[]
  currentTime: number
}) {
  const recent = events
    .filter((event) => event.time <= currentTime)
    .slice(-4)
    .reverse()

  if (recent.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Recent overtakes
      </h3>
      <ul className="space-y-1.5">
        {recent.map((event) => (
          <li key={`${event.number}-${event.time}`} className="flex items-center gap-2 text-sm">
            {event.lap !== null ? (
              <span className="font-mono text-xs text-zinc-500">L{event.lap}</span>
            ) : null}
            <span className="font-semibold text-white">{event.abbreviation ?? event.number}</span>
            <span className="text-zinc-400">up to P{event.to}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
