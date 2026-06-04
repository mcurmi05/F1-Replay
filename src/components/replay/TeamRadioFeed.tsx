import { useEffect, useMemo, useRef, useState } from 'react'
import { teamColor } from '../../lib/format'
import { currentLapNumber } from '../../lib/replay'
import type { ReplayData } from '../../lib/api/types'
import questionIcon from '../../assets/question.png'

function clipRecordedTime(url: string): number | null {
  const file = url.split('/').pop() ?? ''
  const m = file.match(/_(\d{8})_(\d{6})\b/)
  if (!m) return null
  const [, d, t] = m
  const epoch = Date.UTC(
    Number(d.slice(0, 4)),
    Number(d.slice(4, 6)) - 1,
    Number(d.slice(6, 8)),
    Number(t.slice(0, 2)),
    Number(t.slice(2, 4)),
    Number(t.slice(4, 6)),
  )
  return Number.isNaN(epoch) ? null : epoch / 1000
}

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
  const [showAll, setShowAll] = useState(false)
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

  const flaggedUrls = useMemo(() => {
    const all = replay.team_radio ?? []
    const TOLERANCE = 600
    const offsets: number[] = []
    for (const c of all) {
      if (c.time === null) continue
      const recorded = clipRecordedTime(c.url)
      if (recorded !== null) offsets.push(recorded - c.time)
    }
    const flagged = new Set<string>()
    if (offsets.length < 4) return flagged
    const sorted = [...offsets].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    for (const c of all) {
      if (c.time === null) continue
      const recorded = clipRecordedTime(c.url)
      if (recorded === null) continue
      if (Math.abs(recorded - c.time - median) > TOLERANCE) flagged.add(c.url)
    }
    return flagged
  }, [replay.team_radio])

  const teamRadio = useMemo(() => {
    const all = replay.team_radio ?? []
    if (showAll) return all
    return all.filter((c) => !flaggedUrls.has(c.url))
  }, [replay.team_radio, showAll, flaggedUrls])

  useEffect(() => {
    if (showAll || activeUrl === null || !flaggedUrls.has(activeUrl)) return
    audioRef.current?.pause()
    queueRef.current = queueRef.current.filter((url) => !flaggedUrls.has(url))
  }, [showAll, activeUrl, flaggedUrls])

  const burstEnd = useMemo(() => {
    const WINDOW = 5
    const MIN_BURST = 3
    const sorted = teamRadio
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
  }, [teamRadio])

  const relevant = teamRadio.filter(
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

    const crossed = teamRadio
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
  }, [currentTime, autoPlay, teamRadio, burstEnd, activeUrl])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Team Radio</p>
        <div className="flex items-center gap-1.5">
          <div className="group relative">
            <img src={questionIcon} alt="Help" className="h-4 w-4 cursor-help opacity-70 hover:opacity-100" />
            <div className="pointer-events-none absolute right-0 top-6 z-40 hidden w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-[11px] leading-snug text-zinc-300 shadow-xl group-hover:block">
              The radio stream sometimes includes radio messages from F2 sessions that occurred before the F1 session, scroll to the top to see them with F1? toggled on.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              showAll ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Include radio from other series that the feed mislabels as this session"
          >
            <span className={`flex h-2.5 w-2.5 items-center justify-center rounded-[3px] ${showAll ? 'bg-zinc-300 text-zinc-900' : 'border border-zinc-600'}`}>
              {showAll ? (
                <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1.5 5l2.5 2.5L8.5 2.5" />
                </svg>
              ) : null}
            </span>
            F1?
          </button>
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
            const flagged = flaggedUrls.has(clip.url)
            const driver = flagged
              ? undefined
              : (clip.driver_code ? driverByCode.get(clip.driver_code.toUpperCase()) : undefined) ??
                (clip.racing_number ? driverByNumber.get(clip.racing_number) : undefined)
            const label = flagged ? 'Unknown' : clip.driver_code ?? driver?.abbreviation ?? clip.racing_number ?? '?'
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
                  {flagged ? (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6z" />
                      </svg>
                    </div>
                  ) : driver?.headshot_url ? (
                    <img
                      src={driver.headshot_url}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full bg-zinc-800 object-cover"
                    />
                  ) : null}
                  <span className={`font-semibold ${flagged ? 'text-zinc-500' : 'text-zinc-200'}`}>{label}</span>
                  {clip.time !== null && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="font-mono text-zinc-400">
                        {formatTime(origin !== null ? clip.time - origin : clip.time)}
                      </span>
                      {(() => {
                        if (origin !== null && clip.time < origin) return null
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
