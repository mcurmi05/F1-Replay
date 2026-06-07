import { useEffect, useRef } from 'react'
import type { RaceControlMessage } from '../../lib/api/types'

function formatTime(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(seconds)
  const hours = Math.floor(abs / 3600)
  const mins = Math.floor((abs % 3600) / 60)
  const secs = Math.floor(abs % 60)

  if (hours > 0) {
    return `${sign}${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${sign}${mins}:${String(secs).padStart(2, '0')}`
}

export default function RaceControlFeed({
  messages,
  currentTime,
  origin = null,
}: {
  messages: RaceControlMessage[]
  currentTime: number
  origin?: number | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Newest first: most recent message at the top, oldest at the bottom.
  const relevant = messages.filter((m) => m.time !== null && m.time <= currentTime).reverse()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [relevant.length])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Race Control</p>
      <div ref={scrollRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-xs">
        {relevant.length === 0 ? (
          messages.length === 0 ? (
            <p className="text-zinc-500">This session has no race control data.</p>
          ) : (
            <p className="text-zinc-500">No race control messages</p>
          )
        ) : (
          relevant.map((msg, idx) => (
            <div
              key={idx}
              className="rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-normal text-zinc-200">{msg.message}</p>
                {msg.time !== null && (
                  <div className="shrink-0 text-right text-xs text-zinc-400">
                    {origin !== null ? (
                      <>
                        <p>{formatTime(Math.max(0, msg.time - origin))}</p>
                        <p className="text-zinc-600">({formatTime(msg.time)})</p>
                      </>
                    ) : (
                      <p>{formatTime(msg.time)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
