import { useLayoutEffect, useRef, useState } from 'react'

import type { ChampionshipPrediction as ChampionshipPredictionData } from '../../lib/api/types'

function fmtPoints(value: number | null): string {
  if (value === null) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function Movement({ current, predicted }: { current: number | null; predicted: number | null }) {
  if (current === null || predicted === null || current === predicted) {
    return <span className="w-4 shrink-0 text-center text-[10px] text-zinc-600">-</span>
  }
  const gained = current - predicted
  const up = gained > 0
  return (
    <span className={`w-4 shrink-0 text-center text-[10px] font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? '+' : '-'}
      {Math.abs(gained)}
    </span>
  )
}

function Row({
  id,
  position,
  label,
  color,
  current,
  predicted,
  currentPoints,
  predictedPoints,
}: {
  id: string
  position: number | null
  label: string
  color?: string | null
  current: number | null
  predicted: number | null
  currentPoints: number | null
  predictedPoints: number | null
}) {
  const gained =
    currentPoints !== null && predictedPoints !== null ? predictedPoints - currentPoints : null
  return (
    <div data-id={id} className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900/30 px-2 py-0.5">
      <span className="w-4 shrink-0 text-center font-mono text-xs font-semibold text-zinc-400">
        {position ?? '-'}
      </span>
      {color !== undefined ? (
        <span
          className="inline-block h-4 w-12 shrink-0 truncate rounded text-center text-xs font-bold leading-4 text-white"
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
      <span className="ml-auto grid grid-cols-[1.6rem_0.4rem_1.1rem_0.4rem_1.6rem] items-baseline gap-0.5 font-mono text-xs">
        <span className="text-center text-zinc-400">{fmtPoints(currentPoints)}</span>
        <span className={`text-center ${gained !== null && gained > 0 ? 'text-green-400' : 'text-zinc-600'}`}>+</span>
        <span className={`text-center ${gained !== null && gained > 0 ? 'text-green-400' : 'text-zinc-600'}`}>
          {fmtPoints(gained !== null && gained > 0 ? gained : 0)}
        </span>
        <span className="text-center text-zinc-600">=</span>
        <span className="text-center font-semibold text-zinc-100">{fmtPoints(predictedPoints)}</span>
      </span>
      <Movement current={current} predicted={predicted} />
    </div>
  )
}

export default function ChampionshipPrediction({ data }: { data: ChampionshipPredictionData | null }) {
  const [view, setView] = useState<'drivers' | 'teams'>('drivers')
  const listRef = useRef<HTMLDivElement>(null)
  const tops = useRef<Map<string, number>>(new Map())

  const hasData = !!data && (data.drivers.length > 0 || data.teams.length > 0)

  // FLIP: animate rows sliding to their new spot whenever the order changes.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const seen = new Set<string>()
    for (const child of Array.from(list.children) as HTMLElement[]) {
      const id = child.dataset.id
      if (!id) continue
      seen.add(id)
      const next = child.offsetTop
      const previous = tops.current.get(id)
      tops.current.set(id, next)
      if (previous !== undefined && previous !== next) {
        child.animate(
          [{ transform: `translateY(${previous - next}px)` }, { transform: 'translateY(0)' }],
          { duration: 400, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        )
      }
    }
    for (const id of Array.from(tops.current.keys())) {
      if (!seen.has(id)) tops.current.delete(id)
    }
  })

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
      <div ref={listRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {!hasData ? (
          <p className="text-xs text-zinc-500">No projection (race sessions only)</p>
        ) : view === 'drivers' ? (
          data.drivers.map((d) => (
            <Row
              key={d.driver_number}
              id={d.driver_number}
              position={d.predicted_position}
              label={d.abbreviation || d.driver_number}
              color={d.team_colour}
              current={d.current_position}
              predicted={d.predicted_position}
              currentPoints={d.current_points}
              predictedPoints={d.predicted_points}
            />
          ))
        ) : (
          data.teams.map((t) => (
            <Row
              key={t.team_name}
              id={t.team_name}
              position={t.predicted_position}
              label={t.team_name}
              current={t.current_position}
              predicted={t.predicted_position}
              currentPoints={t.current_points}
              predictedPoints={t.predicted_points}
            />
          ))
        )}
      </div>
    </div>
  )
}
