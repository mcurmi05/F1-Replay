import type { RaceControlMessage } from '../../lib/api/types'

function getBg(msg: RaceControlMessage): string {
  if (!msg.category) return 'bg-zinc-900'
  if (msg.category === 'SafetyCar') return 'bg-yellow-900/30'
  if (msg.category === 'Flag' && msg.flag === 'RED') return 'bg-red-900/30'
  if (msg.category === 'Flag' && msg.flag === 'YELLOW') return 'bg-yellow-900/20'
  if (msg.category === 'Drs') return 'bg-blue-900/20'
  return 'bg-zinc-800'
}

function formatUtc(utc: string | null): string {
  if (!utc) return '—'
  try {
    const date = new Date(utc)
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

export default function LiveRaceControl({ messages }: { messages: RaceControlMessage[] }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Race Control</p>
      <div className="mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-500">No race control messages</p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded border border-zinc-700 ${getBg(msg)} px-2 py-1`}
            >
              <p className="text-xs font-semibold text-white">{msg.message || '—'}</p>
              <p className="text-xs text-zinc-400">{formatUtc(msg.time)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
