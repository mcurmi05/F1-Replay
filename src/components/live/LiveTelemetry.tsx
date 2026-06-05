import { useEffect, useMemo, useRef, useState } from 'react'

import { teamColor } from '../../lib/format'
import type { LiveRow } from '../../lib/api/types'

const WINDOW_SECONDS = 10
const THROTTLE_GREEN = '#43b02a'
const BRAKE_RED = '#da291c'
const LIFT_ORANGE = '#f97316'

interface Series {
  times: number[]
  throttle: (number | null)[]
  brake: (number | null)[]
  gear: (number | null)[]
  speed: (number | null)[]
  rpm: (number | null)[]
  drs: (number | null)[]
}

function emptySeries(): Series {
  return { times: [], throttle: [], brake: [], gear: [], speed: [], rpm: [], drs: [] }
}

function lastAtOrBefore(times: number[], t: number): number {
  let lo = 0
  let hi = times.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= t) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

interface TraceSegment {
  color: string
  points: string
}

function channelColor(throttle: number | null, brake: number | null): string {
  if (brake !== null && brake > 0) {
    return BRAKE_RED
  }
  if (throttle === null || throttle <= 0) {
    return LIFT_ORANGE
  }
  return THROTTLE_GREEN
}

function buildSegments(
  times: number[],
  values: (number | null)[],
  windowStart: number,
  windowEnd: number,
  currentValue: number | null,
  colorAt: (index: number) => string,
  currentColor: string,
): TraceSegment[] {
  const span = windowEnd - windowStart
  if (times.length === 0 || span <= 0) {
    return []
  }
  const startIdx = Math.max(0, lastAtOrBefore(times, windowStart))
  const endIdx = lastAtOrBefore(times, windowEnd)
  const pts: { x: number; y: number; color: string }[] = []
  for (let i = startIdx; i <= endIdx; i += 1) {
    const value = values[i]
    if (value === null || value === undefined) {
      continue
    }
    const x = ((times[i] - windowStart) / span) * 100
    const y = 40 - (Math.min(Math.max(value, 0), 100) / 100) * 40
    pts.push({ x, y, color: colorAt(i) })
  }
  if (currentValue !== null) {
    const y = 40 - (Math.min(Math.max(currentValue, 0), 100) / 100) * 40
    pts.push({ x: 100, y, color: currentColor })
  }

  const segments: TraceSegment[] = []
  let prev: { x: number; y: number } | null = null
  for (const point of pts) {
    let last = segments[segments.length - 1]
    if (!last || last.color !== point.color) {
      last = { color: point.color, points: prev ? `${prev.x.toFixed(2)},${prev.y.toFixed(2)} ` : '' }
      segments.push(last)
    }
    last.points += `${point.x.toFixed(2)},${point.y.toFixed(2)} `
    prev = point
  }
  return segments
}

function VerticalBar({ value, color }: { value: number | null; color: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div className="flex min-h-0 shrink-0 flex-col items-center gap-1.5">
      <div className="relative min-h-0 flex-1 w-4 overflow-hidden rounded-md bg-zinc-800">
        <div
          className="absolute bottom-0 left-0 w-full"
          style={{ height: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-9 text-center font-mono text-xs font-semibold tabular-nums text-zinc-300">
        {value === null ? '-' : Math.round(value)}%
      </span>
    </div>
  )
}

function BrakeIndicator({ braking }: { braking: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold transition ${
        braking ? 'bg-f1-red/20 text-f1-red' : 'bg-zinc-800 text-zinc-600'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${braking ? 'bg-f1-red' : 'bg-zinc-600'}`} />
      BRAKE
    </span>
  )
}

function LiftingIndicator({ lifting }: { lifting: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold transition ${
        lifting ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-600'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${lifting ? 'bg-orange-400' : 'bg-zinc-600'}`} />
      LIFTING
    </span>
  )
}

export default function LiveTelemetry({ row }: { row: LiveRow | null }) {
  const bufferRef = useRef<Series>(emptySeries())
  const startRef = useRef<number>(performance.now())
  const driverRef = useRef<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!row) {
      return
    }
    if (driverRef.current !== row.driver_number) {
      driverRef.current = row.driver_number
      bufferRef.current = emptySeries()
      startRef.current = performance.now()
    }
    const t = (performance.now() - startRef.current) / 1000
    const buf = bufferRef.current
    buf.times.push(t)
    buf.throttle.push(row.throttle)
    buf.brake.push(row.brake)
    buf.gear.push(row.gear)
    buf.speed.push(row.speed)
    buf.rpm.push(row.rpm)
    buf.drs.push(row.drs)

    const cutoff = t - WINDOW_SECONDS * 2
    let drop = 0
    while (drop < buf.times.length && buf.times[drop] < cutoff) {
      drop += 1
    }
    if (drop > 0) {
      buf.times = buf.times.slice(drop)
      buf.throttle = buf.throttle.slice(drop)
      buf.brake = buf.brake.slice(drop)
      buf.gear = buf.gear.slice(drop)
      buf.speed = buf.speed.slice(drop)
      buf.rpm = buf.rpm.slice(drop)
      buf.drs = buf.drs.slice(drop)
    }
    setTick((n) => n + 1)
  }, [row])

  const series = bufferRef.current
  const currentTime = series.times.length > 0 ? series.times[series.times.length - 1] : 0
  void tick

  const idx = series.times.length > 0 ? Math.max(0, lastAtOrBefore(series.times, currentTime)) : -1
  const speed = idx >= 0 ? series.speed[idx] ?? null : null
  const throttle = idx >= 0 ? series.throttle[idx] ?? null : null
  const brakeValue = idx >= 0 ? series.brake[idx] ?? null : null
  const braking = brakeValue !== null && brakeValue > 0
  const lifting = !braking && throttle !== null && throttle <= 0
  const gear = idx >= 0 ? series.gear[idx] ?? null : null
  const rpm = idx >= 0 ? series.rpm[idx] ?? null : null
  const drs = idx >= 0 ? series.drs[idx] ?? null : null
  const drsOpen = drs !== null && drs >= 10

  const windowEnd = currentTime
  const windowStart = currentTime - WINDOW_SECONDS
  const throttleSegments = useMemo(
    () =>
      buildSegments(
        series.times,
        series.throttle,
        windowStart,
        windowEnd,
        throttle,
        (i) => channelColor(series.throttle[i], series.brake[i] ?? null),
        channelColor(throttle, brakeValue),
      ),
    [series.times, windowStart, windowEnd, throttle, brakeValue],
  )
  const brakeSegments = useMemo(
    () =>
      buildSegments(
        series.times,
        series.brake,
        windowStart,
        windowEnd,
        brakeValue,
        () => BRAKE_RED,
        BRAKE_RED,
      ),
    [series.times, windowStart, windowEnd, brakeValue],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-surface p-3">
      <div className="flex items-center gap-2.5">
        <span
          className="h-4 w-1.5 rounded-full"
          style={{ backgroundColor: teamColor(row?.team_colour ?? null) }}
        />
        <span className="font-semibold text-white">
          {row?.full_name ?? row?.abbreviation ?? row?.driver_number ?? '-'}
        </span>
        {row?.team_name ? <span className="text-sm text-zinc-500">{row.team_name}</span> : null}
        <span className="ml-auto font-mono text-2xl font-bold text-white">
          {speed === null ? '-' : Math.round(speed)}
          <span className="text-sm font-normal text-zinc-500"> km/h</span>
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
        <span>
          Gear <span className="font-mono text-zinc-200">{gear === null ? '-' : Math.round(gear)}</span>
        </span>
        <span>
          RPM <span className="font-mono text-zinc-200">{rpm === null ? '-' : Math.round(rpm)}</span>
        </span>
        <BrakeIndicator braking={braking} />
        <LiftingIndicator lifting={lifting} />
        {drsOpen && (
          <span>
            DRS <span className="font-mono font-semibold text-blue-400">ACTIVE</span>
          </span>
        )}
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">Throttle</div>
        <div className="flex min-h-0 flex-1 items-stretch gap-3">
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="min-h-0 flex-1 rounded-md bg-zinc-900/40"
          >
            {throttleSegments.map((segment, index) => (
              <polyline
                key={index}
                points={segment.points}
                fill="none"
                stroke={segment.color}
                strokeWidth={0.9}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <VerticalBar value={throttle} color={THROTTLE_GREEN} />
        </div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">Brake</div>
        <div className="flex min-h-0 flex-1 items-stretch gap-3">
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="min-h-0 flex-1 rounded-md bg-zinc-900/40"
          >
            {brakeSegments.map((segment, index) => (
              <polyline
                key={index}
                points={segment.points}
                fill="none"
                stroke={segment.color}
                strokeWidth={0.9}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <VerticalBar value={brakeValue} color={BRAKE_RED} />
        </div>
      </div>
    </div>
  )
}
