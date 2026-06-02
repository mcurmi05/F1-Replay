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

  const telemetryPoint = telemetry ? telemetry[frame] : null
  const mguk = telemetryPoint?.mguk ?? null
  const mguh = telemetryPoint?.mguh ?? null
  const airTemp = telemetryPoint?.air_temp ?? null
  const roadTemp = telemetryPoint?.road_temp ?? null
  const brakeTemp = telemetryPoint?.brake_temp ?? null
  const windSpeed = telemetryPoint?.wind_speed ?? null
  const windDirection = telemetryPoint?.wind_direction ?? null

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
      </p>

      {(mguk !== null || mguh !== null) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {mguk !== null && <Gauge label="MGU-K" value={mguk} unit="%" max={100} color="#0088ff" />}
          {mguh !== null && <Gauge label="MGU-H" value={mguh} unit="%" max={100} color="#00ddff" />}
        </div>
      )}

      {(airTemp !== null || roadTemp !== null || brakeTemp !== null) && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {airTemp !== null && <Gauge label="Air Temp" value={airTemp} unit="°C" max={50} color="#ffa500" />}
          {roadTemp !== null && <Gauge label="Road Temp" value={roadTemp} unit="°C" max={150} color="#ff6b6b" />}
          {brakeTemp !== null && <Gauge label="Brake Temp" value={brakeTemp} unit="°C" max={1000} color="#ff0000" />}
        </div>
      )}

      {(windSpeed !== null || windDirection !== null) && (
        <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900/40 p-2.5">
          <div className="text-xs text-zinc-500">Wind</div>
          <div className="mt-1 flex gap-4">
            {windSpeed !== null && (
              <div className="font-mono text-sm">
                <span className="text-zinc-400">Speed: </span>
                <span className="text-zinc-200">{Math.round(windSpeed)} m/s</span>
              </div>
            )}
            {windDirection !== null && (
              <div className="font-mono text-sm">
                <span className="text-zinc-400">Direction: </span>
                <span className="text-zinc-200">{Math.round(windDirection)}°</span>
              </div>
            )}
          </div>
        </div>
      )}

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
