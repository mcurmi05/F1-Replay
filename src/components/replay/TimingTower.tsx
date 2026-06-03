import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { formatLapTime, teamColor } from '../../lib/format'
import { tyreIcon } from '../../lib/replay'

export interface TimingTowerRow {
  number: string
  abbreviation: string | null
  team_colour: string | null
  position: number | null
  compound: string | null
  pitted: boolean
  interval: string | null
  gap_leader: string | null
  best_lap: number | null
  best_lap_compound: string | null
}

export default function TimingTower({
  rows,
  selected = null,
  onSelect,
  header,
  mode = 'race',
}: {
  rows: TimingTowerRow[]
  selected?: string | null
  onSelect?: (driver: string) => void
  header?: ReactNode
  mode?: 'race' | 'lap'
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const tops = useRef<Map<string, number>>(new Map())
  const order = useRef<string>('')

  const [moves, setMoves] = useState<Record<string, { dir: 'up' | 'down'; count: number }>>({})
  const lastPos = useRef<Map<string, number>>(new Map())
  const anchorPos = useRef<Map<string, number>>(new Map())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const [rowH, setRowH] = useState(28)

  useEffect(() => {
    const changed: Record<string, { dir: 'up' | 'down'; count: number } | null> = {}
    for (const row of rows) {
      if (row.position === null) {
        continue
      }
      const previous = lastPos.current.get(row.number)
      lastPos.current.set(row.number, row.position)
      if (previous === undefined || previous === row.position) {
        continue
      }
      let anchor = anchorPos.current.get(row.number)
      if (anchor === undefined) {
        anchor = previous
        anchorPos.current.set(row.number, anchor)
      }
      const count = Math.abs(row.position - anchor)
      changed[row.number] = count === 0 ? null : { dir: row.position < anchor ? 'up' : 'down', count }
    }
    const ids = Object.keys(changed)
    if (ids.length === 0) {
      return
    }
    setMoves((current) => {
      const next = { ...current }
      for (const id of ids) {
        const value = changed[id]
        if (value === null) {
          delete next[id]
        } else {
          next[id] = value
        }
      }
      return next
    })
    for (const id of ids) {
      const existing = timers.current.get(id)
      if (existing) {
        clearTimeout(existing)
      }
      if (changed[id] === null) {
        timers.current.delete(id)
        anchorPos.current.delete(id)
        continue
      }
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id)
          anchorPos.current.delete(id)
          setMoves((current) => {
            const next = { ...current }
            delete next[id]
            return next
          })
        }, 2000),
      )
    }
  }, [rows])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const update = () => {
      if (rows.length > 0) setRowH(list.offsetHeight / rows.length)
    }
    update()
    const obs = new ResizeObserver(update)
    obs.observe(list)
    return () => obs.disconnect()
  }, [rows.length])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }
    const signature = rows.map((row) => row.number).join(',')
    if (signature === order.current) {
      return
    }
    order.current = signature

    for (const child of Array.from(list.children) as HTMLElement[]) {
      const id = child.dataset.driver
      if (!id) {
        continue
      }
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
  })

  const t = Math.max(0, Math.min(1, (rowH - 28) / 52))
  const fs = 14 + t * 5
  const iconPx = Math.round(18 + t * 10)
  const barH = Math.round(14 + t * 10)
  const barW = Math.round(3 + t * 2)
  const posW = Math.round(fs * 1.4)
  const dataColW = Math.round(fs * 4.8)
  const bestLapW = Math.round(fs * 6)
  const tyreColW = Math.round(fs * 2.2)
  const pitTyreW = Math.round(fs * 3.4)
  const moveSz = Math.round(fs * 0.75)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-surface p-2">
      {header ? <div className="mb-1 flex-none border-b border-zinc-800 pb-1.5">{header}</div> : null}
      <div className="flex flex-none items-center gap-2 px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        <span style={{ width: posW }} className="text-right">P</span>
        <span style={{ width: barW }} className="shrink-0" />
        <span>Driver</span>
        {mode === 'lap' ? (
          <>
            <span style={{ width: bestLapW }} className="ml-auto text-right">Best Lap</span>
            <span style={{ width: tyreColW }} className="text-center">Best</span>
            <span style={{ width: tyreColW }} className="text-center">Tyre</span>
          </>
        ) : (
          <>
            <span style={{ width: dataColW }} className="ml-auto text-right">Interval</span>
            <span style={{ width: dataColW }} className="text-right">Leader</span>
            <span style={{ width: pitTyreW }} />
          </>
        )}
      </div>
      <ul ref={listRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {rows.map((row, idx) => {
          const icon = tyreIcon(row.compound)
          const isSelected = selected === row.number
          const move = moves[row.number]
          return (
            <li key={row.number} data-driver={row.number} className="flex min-h-7 flex-1" style={{ maxHeight: 80 }}>
              <button
                type="button"
                onClick={() => onSelect?.(row.number)}
                style={{ fontSize: fs }}
                className={[
                  'flex h-full w-full items-center gap-2 rounded-md px-2 transition',
                  isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50',
                ].join(' ')}
              >
                <span style={{ width: posW }} className="shrink-0 text-right font-mono text-zinc-400">{row.position ?? '-'}</span>
                <span
                  className="shrink-0 rounded-full"
                  style={{ height: barH, width: barW, backgroundColor: teamColor(row.team_colour) }}
                />
                <span className="font-semibold text-white">{row.abbreviation ?? row.number}</span>
                {move ? (
                  <span
                    style={{ fontSize: moveSz }}
                    className={[
                      'flex items-center gap-0.5 font-bold leading-none',
                      move.dir === 'up' ? 'text-emerald-500' : 'text-f1-red',
                    ].join(' ')}
                  >
                    <svg viewBox="0 0 10 10" style={{ width: moveSz, height: moveSz }} fill="currentColor" aria-hidden="true">
                      {move.dir === 'up' ? <path d="M5 1l4 7H1z" /> : <path d="M5 9L1 2h8z" />}
                    </svg>
                    {move.count}
                  </span>
                ) : null}
                {mode === 'lap' ? (
                  <>
                    <span style={{ width: bestLapW, fontSize: fs * 0.82 }} className="ml-auto shrink-0 text-right font-mono text-zinc-200">
                      {row.best_lap !== null ? formatLapTime(row.best_lap) : '-'}
                    </span>
                    <span style={{ width: tyreColW }} className="flex shrink-0 items-center justify-center">
                      {tyreIcon(row.best_lap_compound) ? (
                        <img src={tyreIcon(row.best_lap_compound)} alt={row.best_lap_compound ?? ''} style={{ width: iconPx, height: iconPx }} />
                      ) : (
                        <span style={{ width: iconPx, height: iconPx }} />
                      )}
                    </span>
                    <span style={{ width: tyreColW }} className="flex shrink-0 items-center justify-center">
                      {icon ? (
                        <img src={icon} alt={row.compound ?? ''} style={{ width: iconPx, height: iconPx }} />
                      ) : (
                        <span style={{ width: iconPx, height: iconPx }} />
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ width: dataColW, fontSize: fs * 0.82 }} className="ml-auto shrink-0 text-right font-mono text-zinc-300">
                      {idx === 0 ? '' : row.interval ?? '-'}
                    </span>
                    <span style={{ width: dataColW, fontSize: fs * 0.82 }} className="shrink-0 text-right font-mono text-zinc-500">
                      {idx === 0 ? 'LEADER' : row.gap_leader ?? '-'}
                    </span>
                    <span style={{ width: pitTyreW }} className="flex shrink-0 items-center justify-end gap-1.5">
                      {row.pitted ? (
                        <span style={{ fontSize: moveSz }} className="rounded bg-amber-500/20 px-1 font-bold uppercase text-amber-400">
                          pit
                        </span>
                      ) : null}
                      {icon ? (
                        <img src={icon} alt={row.compound ?? ''} style={{ width: iconPx, height: iconPx }} />
                      ) : (
                        <span style={{ width: iconPx, height: iconPx }} />
                      )}
                    </span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
