import { PauseIcon, PlayIcon, SkipToStartIcon } from '../icons'
import { formatClock } from '../../lib/format'
import type { Playback } from '../../hooks/usePlayback'

const SPEEDS = [1, 2, 5, 10, 20]

export default function PlaybackControls({
  playback,
  duration,
  raceStart,
}: {
  playback: Playback
  duration: number
  raceStart: number | null
}) {
  const { currentTime, playing, speed, setSpeed, toggle, seek } = playback

  function handleToggle() {
    if (!playing && currentTime >= duration) {
      seek(0)
    }
    toggle()
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-800 bg-surface p-4">
      {raceStart !== null ? (
        <button
          type="button"
          onClick={() => seek(raceStart)}
          title="Jump to race start"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:bg-zinc-800"
        >
          <SkipToStartIcon className="h-4 w-4" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={handleToggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-f1-red text-white transition hover:brightness-110"
      >
        {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
      </button>

      <span className="shrink-0 font-mono text-sm text-zinc-300">
        {formatClock(currentTime)} / {formatClock(duration)}
      </span>

      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={currentTime}
        onChange={(event) => seek(Number(event.target.value))}
        className="h-1.5 min-w-40 flex-1 cursor-pointer accent-f1-red"
      />

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
