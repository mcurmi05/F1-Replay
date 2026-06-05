import { useMemo } from 'react'

import { teamColor } from '../../lib/format'
import { useTelemetry } from '../../hooks/useApi'
import type { ReplayData } from '../../lib/api/types'

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
  throttle: (number | null)[],
  brake: (number | null)[],
  windowStart: number,
  windowEnd: number,
  currentThrottle: number | null,
  currentBrake: number | null,
): TraceSegment[] {
  const span = windowEnd - windowStart
  if (times.length === 0 || span <= 0) {
    return []
  }
  const startIdx = Math.max(0, lastAtOrBefore(times, windowStart))
  const endIdx = lastAtOrBefore(times, windowEnd)
  const pts: { x: number; y: number; color: string }[] = []
  for (let i = startIdx; i <= endIdx; i += 1) {
    const value = throttle[i]
    if (value === null || value === undefined) {
      continue
    }
    const x = ((times[i] - windowStart) / span) * 100
    const y = 40 - (Math.min(Math.max(value, 0), 100) / 100) * 40
    pts.push({ x, y, color: channelColor(value, brake[i] ?? null) })
  }
  if (currentThrottle !== null) {
    const y = 40 - (Math.min(Math.max(currentThrottle, 0), 100) / 100) * 40
    pts.push({ x: 100, y, color: channelColor(currentThrottle, currentBrake) })
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

function DRSIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold transition ${
        active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-600'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
      DRS
    </span>
  )
}

export default function TelemetryPanel({
  year,
  event,
  session,
  replay,
  driver,
  currentTime,
}: {
  year: number
  event: string
  session: string
  replay: ReplayData
  driver: string
  currentTime: number
}) {
  const { data: telemetry } = useTelemetry(year, event, session, driver)
  const info = replay.drivers.find((d) => d.number === driver)
  const path = replay.positions[driver]

  const series = useMemo<Series | null>(() => {
    if (telemetry && telemetry.length > 0) {
      const pts = telemetry.filter((p) => p.time !== null)
      return {
        times: pts.map((p) => p.time as number),
        throttle: pts.map((p) => p.throttle),
        brake: pts.map((p) => (p.brake === null ? null : p.brake ? 100 : 0)),
        gear: pts.map((p) => p.gear),
        speed: pts.map((p) => p.speed),
        rpm: pts.map((p) => p.rpm),
        drs: pts.map((p) => p.drs),
      }
    }
    if (path) {
      return {
        times: replay.time,
        throttle: path.throttle ?? [],
        brake: (path.brake ?? []).map((b) => (b === null ? null : b * 100)),
        gear: path.gear ?? [],
        speed: path.speed ?? [],
        rpm: [],
        drs: [],
      }
    }
    return null
  }, [telemetry, path, replay.time])

  const hasTelemetry =
    !!series && (series.speed.length > 0 || series.throttle.length > 0 || series.gear.length > 0)

  const idx = series ? Math.max(0, lastAtOrBefore(series.times, currentTime)) : -1
  const speed = series ? series.speed[idx] ?? null : null
  const throttle = series ? series.throttle[idx] ?? null : null
  const brakeValue = series ? series.brake[idx] ?? null : null
  const braking = brakeValue !== null && brakeValue > 0
  const lifting = !braking && throttle !== null && throttle <= 0
  const gear = series ? series.gear[idx] ?? null : null
  const rpm = series && series.rpm.length > 0 ? series.rpm[idx] ?? null : null
  const drs = series && series.drs.length > 0 ? series.drs[idx] ?? null : null

  const windowEnd = currentTime
  const windowStart = currentTime - WINDOW_SECONDS
  const throttleSegments = series
    ? buildSegments(series.times, series.throttle, series.brake, windowStart, windowEnd, throttle, brakeValue)
    : []

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-surface p-3 pr-2">
      <div className="flex items-center gap-2.5">
        <span
          className="h-4 w-1.5 rounded-full"
          style={{ backgroundColor: teamColor(info?.team_colour ?? null) }}
        />
        <span className="font-semibold text-white">
          {info?.full_name ?? info?.abbreviation ?? driver}
        </span>
        {info?.team_name ? <span className="text-sm text-zinc-500">{info.team_name}</span> : null}
        <span className="ml-auto flex shrink-0 items-baseline justify-end font-mono text-2xl font-bold text-white">
          <span className="tabular-nums">
            {speed === null ? '-' : Math.round(speed)}
          </span>
          <span className="ml-1 text-sm font-normal text-zinc-500">km/h</span>
        </span>
      </div>

      {hasTelemetry ? (
        <>
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <span>
              Gear <span className="font-mono text-zinc-200">{gear === null ? '-' : Math.round(gear)}</span>
            </span>
            <span>
              RPM <span className="font-mono text-zinc-200">{rpm === null ? '-' : Math.round(rpm)}</span>
            </span>
            <BrakeIndicator braking={braking} />
            <LiftingIndicator lifting={lifting} />
            <DRSIndicator active={drs !== null && drs >= 10} />
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
        </>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center text-center">
          <p className="text-sm text-zinc-500">This session has no telemetry data.</p>
        </div>
      )}
    </div>
  )
}
