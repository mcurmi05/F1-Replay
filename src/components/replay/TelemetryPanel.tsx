import { useMemo } from 'react'

import { frameIndex, sampleChannel } from '../../lib/replay'
import { teamColor } from '../../lib/format'
import { useTelemetry } from '../../hooks/useApi'
import type { ReplayData } from '../../lib/api/types'

function Gauge({
  label,
  value,
  unit,
  max,
  color,
}: {
  label: string
  value: number | null
  unit: string
  max: number
  color: string
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-zinc-300">
          {value === null ? '-' : Math.round(value)}
          {unit}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
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
  const frame = frameIndex(currentTime, replay.step, replay.time.length)
  const speed = sampleChannel(path?.speed, frame)
  const throttle = sampleChannel(path?.throttle, frame)
  const brake = sampleChannel(path?.brake, frame)
  const gear = sampleChannel(path?.gear, frame)

  const telemetryPoint = telemetry && telemetry.length > frame ? telemetry[frame] : null
  const drs = telemetryPoint?.drs ?? null

  const trace = useMemo(() => {
    const values = path?.speed ?? []
    const length = values.length
    if (length < 2) {
      return ''
    }
    const stepEvery = Math.max(1, Math.floor(length / 400))
    const points: string[] = []
    for (let i = 0; i < length; i += stepEvery) {
      const value = values[i]
      if (value === null || value === undefined) {
        continue
      }
      const x = (i / (length - 1)) * 100
      const y = 40 - (Math.min(value, 360) / 360) * 40
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
    }
    return points.join(' ')
  }, [path])

  const cursorX = replay.duration > 0 ? (currentTime / replay.duration) * 100 : 0

  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <span
          className="h-4 w-1.5 rounded-full"
          style={{ backgroundColor: teamColor(info?.team_colour ?? null) }}
        />
        <span className="font-semibold text-white">
          {info?.full_name ?? info?.abbreviation ?? driver}
        </span>
        {info?.team_name ? <span className="text-sm text-zinc-500">{info.team_name}</span> : null}
        <span className="ml-auto font-mono text-2xl font-bold text-white">
          {speed === null ? '-' : Math.round(speed)}
          <span className="text-sm font-normal text-zinc-500"> km/h</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Gauge label="Throttle" value={throttle} unit="%" max={100} color="#43b02a" />
        <Gauge label="Brake" value={brake === null ? null : brake * 100} unit="%" max={100} color="#da291c" />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Gear <span className="font-mono text-zinc-200">{gear === null ? '-' : gear}</span>
        {drs !== null && drs > 0 && (
          <span className="ml-4">
            DRS <span className={`font-mono ${drs === 2 ? 'text-blue-400 font-semibold' : 'text-zinc-400'}`}>{drs === 2 ? 'ACTIVE' : 'Available'}</span>
          </span>
        )}
      </p>

      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-4 h-20 w-full">
        <polyline
          points={trace}
          fill="none"
          stroke="#52525b"
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={cursorX}
          y1={0}
          x2={cursorX}
          y2={40}
          stroke="#e10600"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
