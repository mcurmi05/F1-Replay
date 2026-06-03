import { useEffect, useRef } from 'react'
import { teamColor } from '../../lib/format'
import type { ReplayData } from '../../lib/api/types'

interface PitStop {
  time: number
  driver_number: string
  abbreviation: string | null
  team_colour: string | null
  duration: number
  lap: number | null
}

function getPitStops(replay: ReplayData): PitStop[] {
  const pits: PitStop[] = []

  for (const driver of replay.drivers) {
    const laps = replay.laps[driver.number]
    if (!laps) continue

    for (let i = 0; i < laps.length - 1; i++) {
      const currentLap = laps[i]
      const nextLap = laps[i + 1]

      if (currentLap.pit_in !== null && nextLap.pit_out !== null) {
        const duration = nextLap.pit_out - currentLap.pit_in
        pits.push({
          time: currentLap.pit_in,
          driver_number: driver.number,
          abbreviation: driver.abbreviation,
          team_colour: driver.team_colour,
          duration,
          lap: currentLap.lap,
        })
      }
    }
  }

  return pits.sort((a, b) => a.time - b.time)
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(2)
  return `${mins}:${secs}`
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function PitStopFeed({
  replay,
  currentTime,
  label = 'Race',
}: {
  replay: ReplayData
  currentTime: number
  label?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const allPits = getPitStops(replay)
  const raceStarted = replay.race_start !== null && currentTime >= replay.race_start
  const pits = allPits.filter((pit) => pit.time <= currentTime)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [pits.length])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label} Pit Stops</p>
      <div ref={scrollRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {!raceStarted ? (
          <p className="text-xs text-zinc-500">{label} hasn't started yet</p>
        ) : pits.length === 0 ? (
          <p className="text-xs text-zinc-500">No pit stops yet</p>
        ) : (
          pits.map((pit, idx) => (
            <div
              key={idx}
              className="rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: teamColor(pit.team_colour) }}
                  />
                  <span className="font-semibold text-white">{pit.abbreviation}</span>
                  <span className="text-xs text-zinc-500">(Lap {pit.lap})</span>
                </div>
                <span className="text-xs text-zinc-400">{formatTime(pit.time)}</span>
              </div>
              <p className="mt-1 text-xs font-mono text-zinc-400">
                Duration: {formatDuration(Math.min(Math.max(currentTime - pit.time, 0), pit.duration))}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
