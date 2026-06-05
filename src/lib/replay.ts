import greenFlag from '../assets/flags/green_flag.png'
import yellowFlag from '../assets/flags/yellow_flag.png'
import redFlag from '../assets/flags/red_flag.png'
import hardTyre from '../assets/tires/hard.png'
import intermediateTyre from '../assets/tires/intermediate.png'
import mediumTyre from '../assets/tires/medium.png'
import softTyre from '../assets/tires/soft.png'
import wetTyre from '../assets/tires/wet.png'
import type {
  QualifyingSegment,
  RaceControlMessage,
  ReplayData,
  ReplayLap,
  TrackStatusSegment,
  WeatherSample,
} from './api/types'

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

export function sampleChannelHold(
  values: (number | null)[] | undefined,
  frame: FrameIndex,
): number | null {
  if (!values) {
    return null
  }
  const value = values[frame.i0]
  return value === null || value === undefined ? null : value
}

export function smoothChannel(
  values: (number | null)[] | undefined,
  index: number,
  radius: number,
): number | null {
  if (!values) {
    return null
  }
  let sum = 0
  let count = 0
  for (let i = index - radius; i <= index + radius; i += 1) {
    if (i < 0 || i >= values.length) {
      continue
    }
    const value = values[i]
    if (value === null || value === undefined) {
      continue
    }
    sum += value
    count += 1
  }
  return count === 0 ? null : sum / count
}

export function sampleChannelSmooth(
  values: (number | null)[] | undefined,
  frame: FrameIndex,
  radius = 1,
): number | null {
  return smoothChannel(values, frame.i0, radius)
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

export type SectorTone = 'best' | 'pb' | 'set' | null

export interface SectorCell {
  value: number | null
  tone: SectorTone
}

export interface TowerRow {
  number: string
  abbreviation: string | null
  team_colour: string | null
  position: number | null
  compound: string | null
  tyre_age: number | null
  pitted: boolean
  retired: boolean
  dns: boolean
  gap_leader: string | null
  interval: string | null
  best_lap: number | null
  best_lap_compound: string | null
  best_lap_tyre_age: number | null
  last_lap: number | null
  live_sectors: SectorCell[]
  best_sectors: SectorCell[]
  personal_best_sectors: SectorCell[]
}

interface SectorBests {
  overall: (number | null)[]
  personal: Map<string, (number | null)[]>
}

function computeSectorBests(replay: ReplayData, time: number): SectorBests {
  const overall: (number | null)[] = [null, null, null]
  const personal = new Map<string, (number | null)[]>()
  for (const driver of replay.drivers) {
    const laps = replay.laps[driver.number] ?? []
    const pb: (number | null)[] = [null, null, null]
    for (const lap of laps) {
      const values = [lap.s1, lap.s2, lap.s3]
      const times = [lap.s1_time, lap.s2_time, lap.s3_time]
      for (let i = 0; i < 3; i++) {
        const v = values[i]
        const t = times[i]
        if (v === null || t === null || t > time) continue
        if (pb[i] === null || v < (pb[i] as number)) pb[i] = v
        if (overall[i] === null || v < (overall[i] as number)) overall[i] = v
      }
    }
    personal.set(driver.number, pb)
  }
  return { overall, personal }
}

function sectorTone(
  value: number | null,
  idx: number,
  driverNumber: string,
  bests: SectorBests,
): SectorTone {
  if (value === null) return null
  const eps = 1e-4
  const ov = bests.overall[idx]
  if (ov !== null && Math.abs(value - ov) < eps) return 'best'
  const pb = bests.personal.get(driverNumber)
  if (pb && pb[idx] !== null && Math.abs(value - (pb[idx] as number)) < eps) return 'pb'
  return 'set'
}

function liveSectorCells(
  laps: ReplayLap[] | undefined,
  lap: ReplayLap | null,
  time: number,
  driverNumber: string,
  bests: SectorBests,
): SectorCell[] {
  const s1Done = lap !== null && lap.s1 !== null && lap.s1_time !== null && lap.s1_time <= time
  let source = lap
  if (!s1Done && lap && laps) {
    const idx = laps.indexOf(lap)
    if (idx > 0) source = laps[idx - 1]
  }
  const values = source ? [source.s1, source.s2, source.s3] : [null, null, null]
  const times = source ? [source.s1_time, source.s2_time, source.s3_time] : [null, null, null]
  return [0, 1, 2].map((i) => {
    const done = values[i] !== null && times[i] !== null && (times[i] as number) <= time
    const value = done ? values[i] : null
    return { value, tone: sectorTone(value, i, driverNumber, bests) }
  })
}

function lapSectorCells(lap: ReplayLap | null, driverNumber: string, bests: SectorBests): SectorCell[] {
  const values = lap ? [lap.s1, lap.s2, lap.s3] : [null, null, null]
  return [0, 1, 2].map((i) => ({ value: values[i], tone: sectorTone(values[i], i, driverNumber, bests) }))
}

function personalBestSectorCells(driverNumber: string, bests: SectorBests): SectorCell[] {
  const pb = bests.personal.get(driverNumber) ?? [null, null, null]
  return [0, 1, 2].map((i) => ({ value: pb[i], tone: sectorTone(pb[i], i, driverNumber, bests) }))
}

function lastCompletedLap(laps: ReplayLap[], time: number): ReplayLap | null {
  let result: ReplayLap | null = null
  let bestEnd = -Infinity
  for (const lap of laps) {
    if (lap.lap_time === null || lap.start === null) continue
    const end = lap.start + lap.lap_time
    if (end <= time && end > bestEnd) {
      bestEnd = end
      result = lap
    }
  }
  return result
}

function bestLapEntry(laps: ReplayLap[], time: number, window?: { start: number; end: number } | null): ReplayLap | null {
  let best: ReplayLap | null = null
  for (const lap of laps) {
    if (lap.lap_time === null || lap.start === null) continue
    if (lap.start + lap.lap_time > time) continue
    if (window && (lap.start < window.start || lap.start >= window.end)) continue
    if (best === null || lap.lap_time < (best.lap_time as number)) best = lap
  }
  return best
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
  const bests = computeSectorBests(replay, time)
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

    const laps = replay.laps[entry.driver.number] ?? []
    const best = bestLapEntry(laps, time)
    const last = lastCompletedLap(laps, time)
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
      retired: entry.driver.retired_at != null && time >= entry.driver.retired_at,
      dns: !!entry.driver.dns,
      gap_leader,
      interval,
      best_lap: best ? best.lap_time : null,
      best_lap_compound: best ? best.compound : null,
      best_lap_tyre_age: best ? best.tyre_age : null,
      last_lap: last ? last.lap_time : null,
      live_sectors: liveSectorCells(laps, entry.lap, time, entry.driver.number, bests),
      best_sectors: lapSectorCells(best, entry.driver.number, bests),
      personal_best_sectors: personalBestSectorCells(entry.driver.number, bests),
    }
  })
}

export interface QualifyingStatus {
  segment: QualifyingSegment | null
  running: boolean
  label: string | null
}

export function qualifyingStatus(
  segments: QualifyingSegment[] | undefined,
  time: number,
): QualifyingStatus {
  if (!segments || segments.length === 0) {
    return { segment: null, running: false, label: null }
  }
  if (time < segments[0].start) {
    return { segment: null, running: false, label: "Qualifying hasn't started yet" }
  }
  for (const segment of segments) {
    if (time >= segment.start && time <= segment.end) {
      return { segment, running: true, label: segment.name }
    }
  }
  let last = segments[0]
  for (const segment of segments) {
    if (time > segment.end) {
      last = segment
    }
  }
  return { segment: last, running: false, label: `${last.name} ended` }
}

export function lapLeaderboard(
  replay: ReplayData,
  time: number,
  window?: { start: number; end: number } | null,
): TowerRow[] {
  const bests = computeSectorBests(replay, time)
  const rows: TowerRow[] = replay.drivers.map((driver) => {
    const laps = replay.laps[driver.number] ?? []
    const best = bestLapEntry(laps, time, window)
    const last = lastCompletedLap(laps, time)
    const current = currentLap(laps, time)
    return {
      number: driver.number,
      abbreviation: driver.abbreviation,
      team_colour: driver.team_colour,
      position: null,
      compound: current ? current.compound : null,
      tyre_age: current ? current.tyre_age : null,
      pitted: current
        ? (current.pit_in !== null &&
            time >= current.pit_in &&
            (current.pit_out === null || time <= current.pit_out))
        : false,
      retired: driver.retired_at != null && time >= driver.retired_at,
      dns: !!driver.dns,
      gap_leader: null,
      interval: null,
      best_lap: best ? best.lap_time : null,
      best_lap_compound: best ? best.compound : null,
      best_lap_tyre_age: best ? best.tyre_age : null,
      last_lap: last ? last.lap_time : null,
      live_sectors: liveSectorCells(laps, current, time, driver.number, bests),
      best_sectors: lapSectorCells(best, driver.number, bests),
      personal_best_sectors: personalBestSectorCells(driver.number, bests),
    }
  })

  rows.sort((a, b) => {
    if (a.best_lap === null && b.best_lap === null) return 0
    if (a.best_lap === null) return 1
    if (b.best_lap === null) return -1
    return a.best_lap - b.best_lap
  })
  rows.forEach((row, idx) => {
    row.position = idx + 1
    if (row.best_lap === null) return
    const leaderBest = rows[0].best_lap
    if (idx > 0 && leaderBest !== null) {
      row.gap_leader = `+${(row.best_lap - leaderBest).toFixed(3)}`
    }
    const aheadBest = idx > 0 ? rows[idx - 1].best_lap : null
    if (aheadBest !== null) {
      row.interval = `+${(row.best_lap - aheadBest).toFixed(3)}`
    }
  })
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

const FLAG_SEVERITY: Record<string, number> = {
  '1': 0,
  '7': 1,
  '2': 2,
  '6': 3,
  '4': 4,
  '5': 5,
}

export function currentRaceControlFlag(
  messages: RaceControlMessage[] | undefined,
  time: number,
): string | null {
  if (!messages || messages.length === 0) {
    return null
  }
  const ordered = [...messages]
    .filter((m) => m.time !== null && (m.flag !== null || m.category === 'Flag'))
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))

  let trackYellow = false
  let red = false
  let sawFlag = false
  const yellowSectors = new Set<number>()

  for (const msg of ordered) {
    if (msg.time === null || msg.time > time) {
      break
    }
    const flag = (msg.flag ?? '').trim().toUpperCase()
    const scope = (msg.scope ?? '').trim().toUpperCase()
    if (!flag) {
      continue
    }
    sawFlag = true
    if (flag === 'YELLOW' || flag === 'DOUBLE YELLOW') {
      if (scope === 'SECTOR' && msg.sector !== null) {
        yellowSectors.add(msg.sector)
      } else {
        trackYellow = true
      }
    } else if (flag === 'CLEAR' || flag === 'GREEN') {
      if (scope === 'SECTOR' && msg.sector !== null) {
        yellowSectors.delete(msg.sector)
      } else {
        trackYellow = false
        yellowSectors.clear()
        red = false
      }
    } else if (flag === 'RED') {
      red = true
    }
  }

  if (!sawFlag) {
    return null
  }
  if (red) {
    return '5'
  }
  if (trackYellow || yellowSectors.size > 0) {
    return '2'
  }
  return '1'
}

export interface FlagOverlay {
  whole: 'red' | 'sc' | 'vsc' | 'yellow' | null
}

export function flagOverlay(replay: ReplayData, time: number): FlagOverlay {
  const messages = replay.race_control_messages ?? []
  const ordered = messages
    .filter((m) => m.time !== null && (m.flag !== null || m.category === 'Flag'))
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))

  let trackYellow = false
  let red = false
  for (const msg of ordered) {
    if (msg.time === null || msg.time > time) break
    const flag = (msg.flag ?? '').trim().toUpperCase()
    const scope = (msg.scope ?? '').trim().toUpperCase()
    if (!flag || scope === 'SECTOR') continue
    if (flag === 'YELLOW' || flag === 'DOUBLE YELLOW') trackYellow = true
    else if (flag === 'CLEAR' || flag === 'GREEN') {
      trackYellow = false
      red = false
    } else if (flag === 'RED') {
      red = true
    }
  }

  const tsCode = currentTrackStatus(replay.track_status, time)?.code ?? null

  let whole: FlagOverlay['whole'] = null
  if (red || tsCode === '5') whole = 'red'
  else if (tsCode === '4') whole = 'sc'
  else if (tsCode === '6' || tsCode === '7') whole = 'vsc'
  else if (trackYellow) whole = 'yellow'

  return { whole }
}

export function mergeFlagCodes(a: string | null, b: string | null): string | null {
  const sevA = a !== null ? FLAG_SEVERITY[a] ?? 0 : -1
  const sevB = b !== null ? FLAG_SEVERITY[b] ?? 0 : -1
  if (sevA < 0 && sevB < 0) {
    return null
  }
  return sevA >= sevB ? a : b
}

export function currentWeather(
  samples: WeatherSample[] | undefined,
  time: number,
): WeatherSample | null {
  if (!samples || samples.length === 0) {
    return null
  }
  let result: WeatherSample | null = null
  for (const sample of samples) {
    if (sample.time <= time) {
      result = sample
    } else {
      break
    }
  }
  return result ?? samples[0]
}

export interface TrackStatusInfo {
  label: string
  color: string
  background: string
  flag: string
}

export function trackStatusInfo(code: string | null): TrackStatusInfo {
  switch (code) {
    case '1':
      return { label: 'Green flag', color: '#22c55e', background: 'rgba(34,197,94,0.15)', flag: greenFlag }
    case '2':
      return { label: 'Yellow flag', color: '#facc15', background: 'rgba(250,204,21,0.15)', flag: yellowFlag }
    case '4':
      return { label: 'Safety car', color: '#facc15', background: 'rgba(250,204,21,0.15)', flag: yellowFlag }
    case '5':
      return { label: 'Red flag', color: '#ef4444', background: 'rgba(239,68,68,0.18)', flag: redFlag }
    case '6':
      return { label: 'Virtual safety car', color: '#facc15', background: 'rgba(250,204,21,0.15)', flag: yellowFlag }
    case '7':
      return { label: 'VSC ending', color: '#facc15', background: 'rgba(250,204,21,0.15)', flag: yellowFlag }
    default:
      return { label: 'Track clear', color: '#22c55e', background: 'rgba(34,197,94,0.15)', flag: greenFlag }
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
    case 'HYPERSOFT':
      return { letter: 'HS', color: '#feb1c1' }
    case 'ULTRASOFT':
      return { letter: 'US', color: '#b24ba7' }
    case 'SUPERSOFT':
      return { letter: 'SS', color: '#fc2b2a' }
    case 'SUPERHARD':
      return { letter: 'SH', color: '#fd7d3c' }
    default:
      return { letter: '?', color: '#71717a' }
  }
}
