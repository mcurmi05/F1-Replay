import { useEffect, useMemo, useRef, useState } from 'react'
import { teamColor } from '../../lib/format'
import type { ReplayData } from '../../lib/api/types'

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function TeamRadioFeed({
  replay,
  currentTime,
}: {
  replay: ReplayData
  currentTime: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  const { driverByCode, driverByNumber } = useMemo(() => {
    const byCode = new Map<string, ReplayData['drivers'][number]>()
    const byNumber = new Map<string, ReplayData['drivers'][number]>()
    for (const d of replay.drivers) {
      if (d.abbreviation) byCode.set(d.abbreviation.toUpperCase(), d)
      byNumber.set(d.number, d)
    }
    return { driverByCode: byCode, driverByNumber: byNumber }
  }, [replay.drivers])

  const floor = replay.race_start ?? replay.session_window?.start ?? null
  const relevant = (replay.team_radio ?? []).filter(
    (c) => c.time !== null && c.time <= currentTime && (floor === null || c.time >= floor),
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [relevant.length])

  function toggle(url: string) {
    const audio = audioRef.current
    if (!audio) return
    if (playingUrl === url) {
      audio.pause()
      setPlayingUrl(null)
      return
    }
    audio.src = url
    audio.play().then(() => setPlayingUrl(url)).catch(() => setPlayingUrl(null))
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Team Radio</p>
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} className="hidden" />
      <div ref={scrollRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-xs">
        {relevant.length === 0 ? (
          <p className="text-zinc-500">No team radio</p>
        ) : (
          relevant.map((clip, idx) => {
            const driver =
              (clip.driver_code ? driverByCode.get(clip.driver_code.toUpperCase()) : undefined) ??
              (clip.racing_number ? driverByNumber.get(clip.racing_number) : undefined)
            const label = clip.driver_code ?? driver?.abbreviation ?? clip.racing_number ?? '?'
            const isPlaying = playingUrl === clip.url
            return (
              <div
                key={idx}
                className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5"
              >
                <span
                  className="h-3 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: teamColor(driver?.team_colour) }}
                />
                <button
                  type="button"
                  onClick={() => toggle(clip.url)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-f1-red text-white hover:brightness-110"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor">
                      <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
                      <rect x="6" y="1" width="2.5" height="8" rx="0.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor">
                      <path d="M2 1.5v7l6-3.5z" />
                    </svg>
                  )}
                </button>
                <span className="font-semibold text-zinc-200">{label}</span>
                {clip.time !== null && (
                  <span className="ml-auto text-xs text-zinc-400">{formatTime(clip.time)}</span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
