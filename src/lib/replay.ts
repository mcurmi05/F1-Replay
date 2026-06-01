import type { ReplayData, ReplayLap } from './api/types'

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
}

export function leaderboard(replay: ReplayData, time: number): TowerRow[] {
  const rows = replay.drivers.map((driver) => {
    const lap = currentLap(replay.laps[driver.number], time)
    return {
      number: driver.number,
      abbreviation: driver.abbreviation,
      team_colour: driver.team_colour,
      position: lap ? lap.position : null,
      compound: lap ? lap.compound : null,
      tyre_age: lap ? lap.tyre_age : null,
      pitted: lap ? lap.pitted : false,
    }
  })
  rows.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  return rows
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
