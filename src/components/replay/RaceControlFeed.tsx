import { useEffect, useRef } from 'react'
import type { RaceControlMessage } from '../../lib/api/types'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function RaceControlFeed({
  messages,
  currentTime,
}: {
  messages: RaceControlMessage[]
  currentTime: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const relevant = messages.filter((m) => m.time !== null && m.time <= currentTime)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
    <div className="flex flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Race Control</p>
      <div ref={scrollRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex h-60 flex-col gap-1 overflow-y-auto text-xs">
        {relevant.length === 0 ? (
          <p className="text-zinc-500">No race control messages</p>
        ) : (
          relevant.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded border border-zinc-700 ${getBg(msg)} px-2 py-1.5`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white">{msg.message}</p>
                {msg.time !== null && (
                  <p className="text-xs text-zinc-400">{formatTime(msg.time)}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
