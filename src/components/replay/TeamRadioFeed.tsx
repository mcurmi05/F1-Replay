import { useEffect, useMemo, useRef, useState } from 'react'
import { teamColor } from '../../lib/format'
import { currentLapNumber } from '../../lib/replay'
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
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [paused, setPaused] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const { driverByCode, driverByNumber } = useMemo(() => {
    const byCode = new Map<string, ReplayData['drivers'][number]>()
    const byNumber = new Map<string, ReplayData['drivers'][number]>()
    for (const d of replay.drivers) {
      if (d.abbreviation) byCode.set(d.abbreviation.toUpperCase(), d)
      byNumber.set(d.number, d)
    }
    return { driverByCode: byCode, driverByNumber: byNumber }
  }, [replay.drivers])

  const origin = replay.race_start ?? replay.session_window?.start ?? null
  const relevant = (replay.team_radio ?? []).filter(
    (c) => c.time !== null && c.time <= currentTime && (origin === null || c.time >= origin),
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [relevant.length])

  function toggle(url: string) {
    const audio = audioRef.current
    if (!audio) return
    if (activeUrl === url) {
      if (audio.paused) {
        if (audio.currentTime >= audio.duration) audio.currentTime = 0
        void audio.play()
      } else {
        audio.pause()
      }
      return
    }
    audio.src = url
    setActiveUrl(url)
    setProgress(0)
    setDuration(0)
    void audio.play().catch(() => setActiveUrl(null))
  }

  function select(url: string) {
    const audio = audioRef.current
    if (!audio || activeUrl === url) return
    audio.src = url
    setActiveUrl(url)
    setProgress(0)
    setDuration(0)
    setPaused(true)
    audio.load()
  }

  function seek(value: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setProgress(value)
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Team Radio</p>
      <audio
        ref={audioRef}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => setPaused(true)}
        className="hidden"
      />
      <div ref={scrollRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-xs">
        {relevant.length === 0 ? (
          <p className="text-zinc-500">No team radio</p>
        ) : (
          relevant.map((clip, idx) => {
            const driver =
              (clip.driver_code ? driverByCode.get(clip.driver_code.toUpperCase()) : undefined) ??
              (clip.racing_number ? driverByNumber.get(clip.racing_number) : undefined)
            const label = clip.driver_code ?? driver?.abbreviation ?? clip.racing_number ?? '?'
            const isActive = activeUrl === clip.url
            const isPlaying = isActive && !paused
            return (
              <div
                key={idx}
                onClick={() => select(clip.url)}
                className="cursor-pointer rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 transition-colors hover:border-zinc-600"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: teamColor(driver?.team_colour) }}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggle(clip.url) }}
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
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="font-mono text-zinc-400">
                        {formatTime(origin !== null ? clip.time - origin : clip.time)}
                      </span>
                      {(() => {
                        const lap = currentLapNumber(replay, clip.time)
                        return lap > 0 ? (
                          <span className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] font-medium text-zinc-500">
                            L{lap}
                          </span>
                        ) : null
                      })()}
                    </span>
                  )}
                </div>
                {isActive && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="w-8 shrink-0 text-right font-mono text-[10px] text-zinc-500">
                      {formatTime(progress)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.05}
                      value={progress}
                      onChange={(e) => seek(Number(e.target.value))}
                      className="h-1 flex-1 cursor-pointer accent-f1-red"
                    />
                    <span className="w-8 shrink-0 font-mono text-[10px] text-zinc-500">
                      {formatTime(duration)}
                    </span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
