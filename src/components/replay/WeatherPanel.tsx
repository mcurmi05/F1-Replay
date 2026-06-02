import type { WeatherSample } from '../../lib/api/types'

function format(value: number | null, suffix: string, digits = 0): string {
  if (value === null) {
    return '-'
  }
  return `${value.toFixed(digits)}${suffix}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</span>
      <span className="font-mono text-xs font-semibold text-white">{value}</span>
    </div>
  )
}

export default function WeatherPanel({ weather }: { weather: WeatherSample | null }) {
  if (!weather) {
    return null
  }
  const direction = weather.wind_direction ?? 0
  return (
    <div className="flex w-full flex-col items-end gap-0.5 rounded-lg bg-black/40 px-2.5 py-2 backdrop-blur-sm">
      {weather.rainfall ? (
        <span className="mb-0.5 inline-flex items-center gap-1 self-center rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Raining
        </span>
      ) : null}
      <Row label="Track" value={format(weather.track_temp, '°C', 1)} />
      <Row label="Air" value={format(weather.air_temp, '°C', 1)} />
      <Row label="Humidity" value={format(weather.humidity, '%', 0)} />
      <Row label="Pressure" value={format(weather.pressure, '', 0)} />
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Wind</span>
        <span className="flex items-center gap-1">
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 shrink-0 text-white"
            style={{ transform: `rotate(${direction}deg)` }}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 21V4M12 4l-5 6M12 4l5 6" />
          </svg>
          <span className="font-mono text-xs font-semibold text-white">
            {format(weather.wind_speed, ' m/s', 1)}
          </span>
        </span>
      </div>
    </div>
  )
}
