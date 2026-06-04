import { useEffect, useRef, useState } from 'react'
import type { CommentaryStream } from '../../lib/api/types'

const DRIFT_TOLERANCE = 0.4

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

export default function CommentaryAudio({
  commentary,
  currentTime,
  playing,
  speed,
}: {
  commentary: CommentaryStream | null
  currentTime: number
  playing: boolean
  speed: number
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<{ destroy: () => void } | null>(null)
  const prevVolume = useRef(0.8)
  const [active, setActive] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [readyUrl, setReadyUrl] = useState<string | null>(null)
  const [errorUrl, setErrorUrl] = useState<string | null>(null)

  const streamStart = commentary?.start ?? 0
  const ready = !!commentary && readyUrl === commentary.url
  const error = !!commentary && errorUrl === commentary.url

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !commentary) return
    const url = commentary.url
    let cancelled = false

    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = url
      setReadyUrl(url)
    } else {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled || !audioRef.current) return
          if (!Hls.isSupported()) {
            setErrorUrl(url)
            return
          }
          const hls = new Hls({ enableWorker: true })
          hls.loadSource(url)
          hls.attachMedia(audioRef.current)
          hls.on(Hls.Events.MANIFEST_PARSED, () => setReadyUrl(url))
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) setErrorUrl(url)
          })
          hlsRef.current = hls
        })
        .catch(() => setErrorUrl(url))
    }

    return () => {
      cancelled = true
      hlsRef.current?.destroy()
      hlsRef.current = null
      audio.removeAttribute('src')
    }
  }, [commentary])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = false
  }, [volume])

  const muted = volume === 0
  function toggleMute() {
    if (volume > 0) {
      prevVolume.current = volume
      setVolume(0)
    } else {
      setVolume(prevVolume.current || 0.8)
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !ready) return
    const target = currentTime - streamStart
    const dur = audio.duration
    const inRange = target >= 0 && (Number.isNaN(dur) || target <= dur)
    const shouldPlay = active && playing && speed === 1 && inRange

    if (shouldPlay) {
      if (Math.abs(audio.currentTime - target) > DRIFT_TOLERANCE) audio.currentTime = target
      if (audio.paused) void audio.play().catch(() => {})
    } else {
      if (!audio.paused) audio.pause()
      if (active && inRange && Math.abs(audio.currentTime - target) > DRIFT_TOLERANCE) {
        audio.currentTime = target
      }
    }
  }, [currentTime, playing, speed, active, ready, streamStart])

  const beforeStart = currentTime < streamStart
  const status = !commentary
    ? null
    : error
      ? 'Commentary stream could not be loaded.'
      : !active
        ? 'Off'
        : beforeStart
          ? `Starts in ${formatCountdown(streamStart - currentTime)}`
          : !ready
            ? 'Loading...'
            : speed !== 1
              ? 'Paused - plays at 1x'
              : playing
                ? 'Following playback'
                : 'Paused'

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Commentary</p>
        {commentary ? (
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              active ? 'bg-f1-red/20 text-red-300' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Sync the world-feed commentary to the replay clock"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-f1-red' : 'bg-zinc-600'}`} />
            {active ? 'On' : 'Off'}
          </button>
        ) : null}
      </div>

      <audio ref={audioRef} className="hidden" preload="auto" />

      {!commentary ? (
        <p className="mt-2 text-[11px] leading-snug text-zinc-500">
          Commentary isn't published for this session.
        </p>
      ) : (
        <div className="mt-2 flex min-h-0 flex-1 flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                active && ready && playing && speed === 1 && !beforeStart ? 'bg-f1-red text-white' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
              </svg>
            </span>
            <span className="text-sm text-zinc-300">{status}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="shrink-0 text-zinc-400 hover:text-white"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M3 10v4h4l5 5V5L7 10H3zm13 .59L14.41 9 13 10.41 14.59 12 13 13.59 14.41 15 16 13.41 17.59 15 19 13.59 17.41 12 19 10.41 17.59 9z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer accent-f1-red"
              title="Volume"
            />
          </div>
        </div>
      )}
    </div>
  )
}
