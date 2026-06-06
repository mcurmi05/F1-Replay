import { useState } from 'react'

import type { ChampionshipPrediction as ChampionshipPredictionData } from '../../lib/api/types'

function fmtPoints(value: number | null): string {
  if (value === null) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function Movement({ current, predicted }: { current: number | null; predicted: number | null }) {
  if (current === null || predicted === null || current === predicted) {
    return <span className="w-6 text-center text-[10px] text-zinc-600">-</span>
  }
  const gained = current - predicted
  const up = gained > 0
  return (
    <span className={`w-6 text-center text-[10px] font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? '+' : '-'}
      {Math.abs(gained)}
    </span>
  )
}

function Row({
  position,
  label,
  color,
  current,
  predicted,
  points,
  gained,
}: {
  position: number | null
  label: string
  color?: string | null
  current: number | null
  predicted: number | null
  points: number | null
  gained: number | null
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/30 px-2 py-1.5">
      <span className="w-5 shrink-0 text-center font-mono text-xs font-semibold text-zinc-400">
        {position ?? '-'}
      </span>
      <Movement current={current} predicted={predicted} />
      {color !== undefined ? (
        <span
          className="inline-block h-5 w-12 shrink-0 truncate rounded text-center text-xs font-bold leading-5 text-white"
          style={{ backgroundColor: color || '#71717a' }}
          title={label}
        >
          {label}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200" title={label}>
          {label}
        </span>
      )}
      <span className="ml-auto font-mono text-sm text-zinc-200">{fmtPoints(points)}</span>
      {gained !== null && gained > 0 ? (
        <span className="w-9 shrink-0 text-right font-mono text-[10px] text-green-400">+{fmtPoints(gained)}</span>
      ) : (
        <span className="w-9 shrink-0" />
      )}
    </div>
  )
}

export default function ChampionshipPrediction({ data }: { data: ChampionshipPredictionData | null }) {
  const [view, setView] = useState<'drivers' | 'teams'>('drivers')

  const hasData = !!data && (data.drivers.length > 0 || data.teams.length > 0)

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Projected Standings</p>
        {hasData ? (
          <div className="flex items-center gap-1">
            {(['drivers', 'teams'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                  view === key ? 'bg-f1-red/30 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {key === 'drivers' ? 'Drivers' : 'Teams'}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {!hasData ? (
          <p className="text-xs text-zinc-500">No projection (race sessions only)</p>
        ) : view === 'drivers' ? (
          data.drivers.map((d) => (
            <Row
              key={d.driver_number}
              position={d.predicted_position}
              label={d.abbreviation || d.driver_number}
              color={d.team_colour}
              current={d.current_position}
              predicted={d.predicted_position}
              points={d.predicted_points}
              gained={d.current_points !== null && d.predicted_points !== null ? d.predicted_points - d.current_points : null}
            />
          ))
        ) : (
          data.teams.map((t) => (
            <Row
              key={t.team_name}
              position={t.predicted_position}
              label={t.team_name}
              current={t.current_position}
              predicted={t.predicted_position}
              points={t.predicted_points}
              gained={t.current_points !== null && t.predicted_points !== null ? t.predicted_points - t.current_points : null}
            />
          ))
        )}
      </div>
    </div>
  )
}
