import raceStartIcon from '../../assets/race_start.png'
import skipBackwardIcon from '../../assets/skip_backward.png'
import skipForwardIcon from '../../assets/skip_forward.png'
import { PauseIcon, PlayIcon } from '../icons'
import { formatClockHours } from '../../lib/format'
import type { Playback } from '../../hooks/usePlayback'

const SPEEDS = [1, 2, 5, 10, 20]

export interface PlaybackMarker {
  time: number
  label: string
}

export default function PlaybackControls({
  playback,
  duration,
  raceStart,
  markers = [],
}: {
  playback: Playback
  duration: number
  raceStart: number | null
  markers?: PlaybackMarker[]
}) {
  const { currentTime, playing, speed, setSpeed, toggle, seek } = playback

  const rendered: PlaybackMarker[] = []
  const seen = new Set<number>()
  for (const marker of markers) {
    const clamped = Math.max(0, Math.min(duration, marker.time))
    if (!seen.has(clamped)) {
      seen.add(clamped)
      rendered.push({ time: clamped, label: marker.label })
    }
  }

  const markerTransform = (pct: number): string =>
    pct <= 1 ? 'translateX(0)' : pct >= 99 ? 'translateX(-100%)' : 'translateX(-50%)'

  function handleToggle() {
    if (!playing && currentTime >= duration) {
      seek(0)
    }
    toggle()
  }

  return (
    <div className="flex h-full flex-wrap items-center gap-4 rounded-2xl border border-zinc-800 bg-surface p-4">
      {raceStart !== null ? (
        <button
          type="button"
          onClick={() => seek(raceStart)}
          title="Jump to race start"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-white transition hover:brightness-90"
        >
          <img src={raceStartIcon} alt="Jump to race start" className="h-5 w-5" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => seek(Math.max(0, currentTime - 5))}
        title="Skip back 5 seconds"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-f1-red transition hover:brightness-110"
      >
        <img src={skipBackwardIcon} alt="Skip back 5 seconds" className="h-5 w-5" style={{ transform: 'translateX(-2px)' }} />
      </button>

      <button
        type="button"
        onClick={handleToggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-f1-red text-white transition hover:brightness-110"
      >
        {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
      </button>

      <button
        type="button"
        onClick={() => seek(Math.min(duration, currentTime + 5))}
        title="Skip forward 5 seconds"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-f1-red transition hover:brightness-110"
      >
        <img src={skipForwardIcon} alt="Skip forward 5 seconds" className="h-5 w-5" style={{ transform: 'translateX(2px)' }} />
      </button>

      <span className="shrink-0 font-mono text-sm text-zinc-300">
        {formatClockHours(currentTime)} / {formatClockHours(duration)}
      </span>

      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(event) => seek(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer accent-f1-red"
          />
          {rendered.map((marker) => {
            const pct = (marker.time / duration) * 100
            return (
              <span
                key={marker.time}
                className="pointer-events-none absolute top-1/2 h-3 w-0.5 rounded bg-zinc-200"
                style={{ left: `${pct}%`, transform: `${markerTransform(pct)} translateY(-50%)` }}
              />
            )
          })}
        </div>
        {rendered.length > 0 ? (
          <div className="relative h-4">
            {rendered.map((marker) => {
              const pct = (marker.time / duration) * 100
              return (
                <button
                  key={marker.time}
                  type="button"
                  onClick={() => seek(marker.time)}
                  style={{ left: `${pct}%`, transform: markerTransform(pct) }}
                  className="absolute text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:text-white"
                >
                  {marker.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSpeed(value)}
            className={[
              'rounded-md px-2.5 py-1 text-xs font-semibold transition',
              value === speed
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
            ].join(' ')}
          >
            {value}x
          </button>
        ))}
      </div>
    </div>
  )
}
