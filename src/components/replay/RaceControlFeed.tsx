import { useEffect, useRef } from 'react'
import type { RaceControlMessage } from '../../lib/api/types'

export default function RaceControlFeed({
  messages,
  currentTime,
}: {
  messages: RaceControlMessage[]
  currentTime: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const relevant = messages.filter((m) => m.time !== null && m.time <= currentTime)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [relevant.length])

  const getBg = (msg: RaceControlMessage): string => {
    if (!msg.category) return 'bg-zinc-900'
    if (msg.category === 'SafetyCar') return 'bg-yellow-900/30'
    if (msg.category === 'Flag' && msg.flag === 'RED') return 'bg-red-900/30'
    if (msg.category === 'Flag' && msg.flag === 'YELLOW') return 'bg-yellow-900/20'
    if (msg.category === 'Drs') return 'bg-blue-900/20'
    return 'bg-zinc-800'
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Race Control</p>
      <div
        ref={containerRef}
        className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto text-xs"
      >
        {relevant.length === 0 ? (
          <p className="text-zinc-500">No race control messages</p>
        ) : (
          relevant.map((msg, idx) => (
            <div
              key={idx}
              ref={idx === relevant.length - 1 ? scrollRef : undefined}
              className={`rounded border border-zinc-700 ${getBg(msg)} px-2 py-1`}
            >
              <p className="font-semibold text-white">{msg.message}</p>
              {msg.time !== null && (
                <p className="text-zinc-400">{msg.time.toFixed(1)}s</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
