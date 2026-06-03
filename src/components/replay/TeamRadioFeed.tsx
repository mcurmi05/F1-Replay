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
  const [autoPlay, setAutoPlay] = useState(false)
  const queueRef = useRef<string[]>([])
  const lastTimeRef = useRef<number | null>(null)

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

  const burstEnd = useMemo(() => {
    const WINDOW = 5
    const MIN_BURST = 3
    const sorted = (replay.team_radio ?? [])
      .filter((c) => c.time !== null)
      .sort((a, b) => (a.time as number) - (b.time as number))
    if (sorted.length === 0) return null
    let end = sorted[0].time as number
    let count = 1
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i].time as number) - (sorted[i - 1].time as number) <= WINDOW) {
        end = sorted[i].time as number
        count++
      } else {
        break
      }
    }
    return count >= MIN_BURST ? end : null
  }, [replay.team_radio])

  const relevant = (replay.team_radio ?? []).filter(
    (c) => c.time !== null && c.time <= currentTime && (burstEnd === null || c.time > burstEnd),
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

  function playUrl(url: string) {
    const audio = audioRef.current
    if (!audio) return
    audio.src = url
    setActiveUrl(url)
    setProgress(0)
    setDuration(0)
    void audio.play().catch(() => {})
  }

  function handleEnded() {
    if (queueRef.current.length > 0) {
      const [next, ...rest] = queueRef.current
      queueRef.current = rest
      playUrl(next)
    } else {
      setPaused(true)
    }
  }

  useEffect(() => {
    const prev = lastTimeRef.current
    lastTimeRef.current = currentTime
    if (prev === null || !autoPlay || currentTime <= prev) return

    const crossed = (replay.team_radio ?? [])
      .filter(
        (c) =>
          c.time !== null &&
          c.time > prev &&
          c.time <= currentTime &&
          (burstEnd === null || c.time > burstEnd),
      )
      .sort((a, b) => (a.time as number) - (b.time as number))
    if (crossed.length === 0) return

    const audio = audioRef.current
    const busy = !!audio && !audio.paused && activeUrl !== null
    let rest = crossed
    if (!busy) {
      playUrl(crossed[0].url)
      rest = crossed.slice(1)
    }
    queueRef.current = [...queueRef.current, ...rest.map((c) => c.url)]
  }, [currentTime, autoPlay, replay.team_radio, burstEnd, activeUrl])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Team Radio</p>
        <button
          type="button"
          onClick={() => setAutoPlay((v) => {
            if (v) queueRef.current = []
            return !v
          })}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            autoPlay ? 'bg-f1-red/20 text-red-300' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
          title="Auto-play radio as it comes through"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${autoPlay ? 'bg-f1-red' : 'bg-zinc-600'}`} />
          Autoplay
        </button>
      </div>
      <audio
        ref={audioRef}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={handleEnded}
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
                onClick={() => (isActive ? toggle(clip.url) : select(clip.url))}
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
                  {driver?.headshot_url ? (
                    <img
                      src={driver.headshot_url}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full bg-zinc-800 object-cover"
                    />
                  ) : null}
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
