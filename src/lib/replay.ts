import hardTyre from '../assets/tires/hard.png'
import intermediateTyre from '../assets/tires/intermediate.png'
import mediumTyre from '../assets/tires/medium.png'
import softTyre from '../assets/tires/soft.png'
import wetTyre from '../assets/tires/wet.png'
import type { ReplayData, ReplayLap, TrackStatusSegment } from './api/types'

const TYRE_ICON: Record<string, string> = {
  SOFT: softTyre,
  MEDIUM: mediumTyre,
  HARD: hardTyre,
  INTERMEDIATE: intermediateTyre,
  WET: wetTyre,
}

export function tyreIcon(compound: string | null): string | undefined {
  return compound ? TYRE_ICON[compound] : undefined
}

export interface FrameIndex {
  i0: number
  i1: number
  frac: number
}

export function frameIndex(time: number, step: number, length: number): FrameIndex {
  const ratio = step > 0 ? time / step : 0
  const base = Math.floor(ratio)
  const i0 = Math.max(0, Math.min(base, length - 1))
  const i1 = Math.min(i0 + 1, length - 1)
  const frac = Math.max(0, Math.min(ratio - base, 1))
  return { i0, i1, frac }
}

export function sampleChannel(
  values: (number | null)[] | undefined,
  frame: FrameIndex,
): number | null {
  if (!values) {
    return null
  }
  const a = values[frame.i0]
  if (a === null || a === undefined) {
    return null
  }
  const b = values[frame.i1]
  if (b === null || b === undefined) {
    return a
  }
  return a + (b - a) * frame.frac
}

export function currentLap(laps: ReplayLap[] | undefined, time: number): ReplayLap | null {
  if (!laps || laps.length === 0) {
    return null
  }
  let result: ReplayLap | null = null
  for (const lap of laps) {
    if (lap.start === null) {
      continue
    }
    if (lap.start <= time) {
      result = lap
    } else {
      break
    }
  }
  return result ?? laps[0]
}

export interface TowerRow {
  number: string
  abbreviation: string | null
  team_colour: string | null
  position: number | null
  compound: string | null
  tyre_age: number | null
  pitted: boolean
  gap_leader: string | null
  interval: string | null
}

function formatGap(seconds: number): string {
  if (seconds < 60) {
    return `+${seconds.toFixed(3)}`
  }
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `+${minutes}:${rest.toFixed(3).padStart(6, '0')}`
}

function lapsBehind(n: number): string {
  return `+${n} LAP${n > 1 ? 'S' : ''}`
}

export function leaderboard(replay: ReplayData, time: number): TowerRow[] {
  const frame = frameIndex(time, replay.step, replay.time.length)
  const entries = replay.drivers.map((driver) => {
    const lap = currentLap(replay.laps[driver.number], time)
    const pos = replay.positions[driver.number]
    const streamPos = pos?.position?.[frame.i0]
    return {
      driver,
      lap,
      x: sampleChannel(pos?.x, frame),
      y: sampleChannel(pos?.y, frame),
      position: streamPos !== null && streamPos !== undefined ? streamPos : lap ? lap.position : null,
      lapNumber: lap ? lap.lap : null,
    }
  })
  entries.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))

  const leader = entries[0] ?? null

  return entries.map((entry, idx) => {
    let gap_leader: string | null = null
    let interval: string | null = null

    if (idx > 0) {
      const own = replay.positions[entry.driver.number]
      const streamLeader = own?.gap_leader?.[frame.i0] ?? null
      const streamInterval = own?.interval?.[frame.i0] ?? null
      const lappedFromLeader =
        leader && leader.lapNumber !== null && entry.lapNumber !== null
          ? leader.lapNumber - entry.lapNumber
          : 0
      const ahead = entries[idx - 1]
      const lappedFromAhead =
        ahead.lapNumber !== null && entry.lapNumber !== null
          ? ahead.lapNumber - entry.lapNumber
          : 0

      if (streamLeader !== null) {
        gap_leader = formatGap(streamLeader)
      } else if (lappedFromLeader >= 1) {
        gap_leader = lapsBehind(lappedFromLeader)
      }

      if (streamInterval !== null) {
        interval = formatGap(streamInterval)
      } else if (lappedFromAhead >= 1) {
        interval = lapsBehind(lappedFromAhead)
      }
    }

    return {
      number: entry.driver.number,
      abbreviation: entry.driver.abbreviation,
      team_colour: entry.driver.team_colour,
      position: entry.position,
      compound: entry.lap ? entry.lap.compound : null,
      tyre_age: entry.lap ? entry.lap.tyre_age : null,
      pitted: entry.lap
        ? (entry.lap.pit_in !== null &&
            time >= entry.lap.pit_in &&
            (entry.lap.pit_out === null || time <= entry.lap.pit_out))
        : false,
      gap_leader,
      interval,
    }
  })
}

export function currentLapNumber(replay: ReplayData, time: number): number {
  let highest = 0
  for (const driver of replay.drivers) {
    const lap = currentLap(replay.laps[driver.number], time)
    if (lap && lap.lap !== null && lap.lap > highest) {
      highest = lap.lap
    }
  }
  if (replay.total_laps) {
    return Math.min(highest, replay.total_laps)
  }
  return highest
}

export interface OvertakeEvent {
  time: number
  lap: number | null
  number: string
  abbreviation: string | null
  from: number
  to: number
}

export function overtakeEvents(replay: ReplayData): OvertakeEvent[] {
  const events: OvertakeEvent[] = []
  for (const driver of replay.drivers) {
    const laps = replay.laps[driver.number]
    if (!laps) {
      continue
    }
    let previous: number | null = null
    for (const lap of laps) {
      if (
        lap.position !== null &&
        previous !== null &&
        lap.position < previous &&
        lap.start !== null
      ) {
        events.push({
          time: lap.start,
          lap: lap.lap,
          number: driver.number,
          abbreviation: driver.abbreviation,
          from: previous,
          to: lap.position,
        })
      }
      if (lap.position !== null) {
        previous = lap.position
      }
    }
  }
  events.sort((a, b) => a.time - b.time)
  return events
}

export function currentTrackStatus(
  segments: TrackStatusSegment[] | undefined,
  time: number,
): TrackStatusSegment | null {
  if (!segments || segments.length === 0) {
    return null
  }
  let result: TrackStatusSegment | null = null
  for (const segment of segments) {
    if (segment.start <= time) {
      result = segment
    } else {
      break
    }
  }
  return result ?? segments[0]
}

export interface TrackStatusInfo {
  label: string
  color: string
  background: string
}

export function trackStatusInfo(code: string | null): TrackStatusInfo {
  switch (code) {
    case '1':
      return { label: 'Green flag', color: '#22c55e', background: 'rgba(34,197,94,0.15)' }
    case '2':
      return { label: 'Yellow flag', color: '#facc15', background: 'rgba(250,204,21,0.15)' }
    case '4':
      return { label: 'Safety car', color: '#facc15', background: 'rgba(250,204,21,0.15)' }
    case '5':
      return { label: 'Red flag', color: '#ef4444', background: 'rgba(239,68,68,0.18)' }
    case '6':
      return { label: 'Virtual safety car', color: '#facc15', background: 'rgba(250,204,21,0.15)' }
    case '7':
      return { label: 'VSC ending', color: '#facc15', background: 'rgba(250,204,21,0.15)' }
    default:
      return { label: 'Track clear', color: '#22c55e', background: 'rgba(34,197,94,0.15)' }
  }
}

export function compoundInfo(compound: string | null): { letter: string; color: string } {
  switch (compound) {
    case 'SOFT':
      return { letter: 'S', color: '#da291c' }
    case 'MEDIUM':
      return { letter: 'M', color: '#ffd12e' }
    case 'HARD':
      return { letter: 'H', color: '#f4f4f5' }
    case 'INTERMEDIATE':
      return { letter: 'I', color: '#43b02a' }
    case 'WET':
      return { letter: 'W', color: '#3b82f6' }
    default:
      return { letter: '-', color: '#71717a' }
  }
}
