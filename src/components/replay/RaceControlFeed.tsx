import { useEffect, useRef } from 'react'
import type { RaceControlMessage } from '../../lib/api/types'

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
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

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Race Control</p>
      <div ref={scrollRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-xs">
        {relevant.length === 0 ? (
          <p className="text-zinc-500">No race control messages</p>
        ) : (
          relevant.map((msg, idx) => (
            <div
              key={idx}
              className="rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-normal text-zinc-200">{msg.message}</p>
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
