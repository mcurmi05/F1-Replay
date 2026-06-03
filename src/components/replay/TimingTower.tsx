import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { formatLapTime, teamColor } from '../../lib/format'
import { tyreIcon } from '../../lib/replay'
import type { SectorCell, TowerRow } from '../../lib/replay'
import {
  TIMING_COLUMN_LABELS,
  normalizeColumns,
} from '../../lib/timingColumns'
import type { TimingColumnId, TimingColumnState } from '../../lib/timingColumns'

export type TimingTowerRow = TowerRow

function toneClass(tone: SectorCell['tone']): string {
  if (tone === 'best') return 'text-purple-400'
  if (tone === 'pb') return 'text-emerald-400'
  if (tone === 'set') return 'text-zinc-300'
  return 'text-zinc-600'
}

function formatSector(value: number | null): string {
  return value !== null ? value.toFixed(3) : '--'
}

export default function TimingTower({
  rows,
  selected = null,
  onSelect,
  header,
  mode = 'race',
  columns,
  onColumnsChange,
}: {
  rows: TimingTowerRow[]
  selected?: string | null
  onSelect?: (driver: string) => void
  header?: ReactNode
  mode?: 'race' | 'lap'
  columns?: TimingColumnState[] | null
  onColumnsChange?: (next: TimingColumnState[]) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const tops = useRef<Map<string, number>>(new Map())
  const order = useRef<string>('')

  const [moves, setMoves] = useState<Record<string, { dir: 'up' | 'down'; count: number }>>({})
  const lastPos = useRef<Map<string, number>>(new Map())
  const anchorPos = useRef<Map<string, number>>(new Map())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const [rowH, setRowH] = useState(28)
  const [menuOpen, setMenuOpen] = useState(false)

  const resolved = useMemo(() => normalizeColumns(columns, mode), [columns, mode])
  const visible = useMemo(() => resolved.filter((c) => c.visible), [resolved])

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
  const moveSz = Math.round(fs * 0.75)

  const width: Record<Exclude<TimingColumnId, 'driver'>, number> = {
    pos: Math.round(fs * 1.6),
    interval: Math.round(fs * 4.6),
    leader: Math.round(fs * 4.6),
    lastLap: Math.round(fs * 5),
    sectors: Math.round(fs * 9),
    bestLap: Math.round(fs * 5.2),
    bestSectors: Math.round(fs * 9),
    tyre: Math.round(fs * 3.4),
    bestTyre: Math.round(fs * 2.4),
  }

  function headerCell(id: TimingColumnId) {
    switch (id) {
      case 'pos':
        return <span key={id} style={{ width: width.pos }} className="shrink-0 text-right">P</span>
      case 'driver':
        return <span key={id} className="min-w-[3.5em] flex-1">Driver</span>
      case 'interval':
        return <span key={id} style={{ width: width.interval }} className="shrink-0 text-right">Interval</span>
      case 'leader':
        return <span key={id} style={{ width: width.leader }} className="shrink-0 text-right">Leader</span>
      case 'lastLap':
        return <span key={id} style={{ width: width.lastLap }} className="shrink-0 text-right">Last</span>
      case 'sectors':
        return <span key={id} style={{ width: width.sectors }} className="shrink-0 text-center">Sectors</span>
      case 'bestLap':
        return <span key={id} style={{ width: width.bestLap }} className="shrink-0 text-right">Best</span>
      case 'bestSectors':
        return <span key={id} style={{ width: width.bestSectors }} className="shrink-0 text-center">Best Sec</span>
      case 'tyre':
        return <span key={id} style={{ width: width.tyre }} className="shrink-0 text-center">Tyre</span>
      case 'bestTyre':
        return <span key={id} style={{ width: width.bestTyre }} className="shrink-0 text-center">B.Tyre</span>
    }
  }

  function sectorTrio(cells: SectorCell[] | undefined, key: string) {
    const trio = [0, 1, 2].map((i) => cells?.[i] ?? { value: null, tone: null })
    return (
      <span key={key} style={{ width: width.sectors }} className="flex shrink-0 items-center gap-0.5">
        {trio.map((c, i) => (
          <span
            key={i}
            style={{ fontSize: fs * 0.72 }}
            className={`flex-1 rounded bg-zinc-900/50 px-0.5 py-0.5 text-center font-mono ${toneClass(c.tone)}`}
          >
            {formatSector(c.value)}
          </span>
        ))}
      </span>
    )
  }

  function bodyCell(id: TimingColumnId, row: TimingTowerRow, idx: number) {
    switch (id) {
      case 'pos':
        return (
          <span key={id} style={{ width: width.pos }} className="shrink-0 text-right font-mono text-zinc-400">
            {row.position ?? '-'}
          </span>
        )
      case 'driver': {
        const move = moves[row.number]
        return (
          <span key={id} className="flex min-w-[3.5em] flex-1 items-center gap-2">
            <span className="shrink-0 rounded-full" style={{ height: barH, width: barW, backgroundColor: teamColor(row.team_colour) }} />
            <span className="font-semibold text-white">{row.abbreviation ?? row.number}</span>
            {move ? (
              <span
                style={{ fontSize: moveSz }}
                className={['flex items-center gap-0.5 font-bold leading-none', move.dir === 'up' ? 'text-emerald-500' : 'text-f1-red'].join(' ')}
              >
                <svg viewBox="0 0 10 10" style={{ width: moveSz, height: moveSz }} fill="currentColor" aria-hidden="true">
                  {move.dir === 'up' ? <path d="M5 1l4 7H1z" /> : <path d="M5 9L1 2h8z" />}
                </svg>
                {move.count}
              </span>
            ) : null}
          </span>
        )
      }
      case 'interval':
        return (
          <span key={id} style={{ width: width.interval, fontSize: fs * 0.82 }} className="shrink-0 text-right font-mono text-zinc-300">
            {idx === 0 ? '' : row.interval ?? '-'}
          </span>
        )
      case 'leader':
        return (
          <span key={id} style={{ width: width.leader, fontSize: fs * 0.82 }} className="shrink-0 text-right font-mono text-zinc-500">
            {idx === 0 ? 'LEADER' : row.gap_leader ?? '-'}
          </span>
        )
      case 'lastLap':
        return (
          <span key={id} style={{ width: width.lastLap, fontSize: fs * 0.82 }} className="shrink-0 text-right font-mono text-zinc-300">
            {row.last_lap !== null ? formatLapTime(row.last_lap) : '-'}
          </span>
        )
      case 'sectors':
        return sectorTrio(row.live_sectors, id)
      case 'bestLap':
        return (
          <span key={id} style={{ width: width.bestLap, fontSize: fs * 0.82 }} className="shrink-0 text-right font-mono text-zinc-200">
            {row.best_lap !== null ? formatLapTime(row.best_lap) : '-'}
          </span>
        )
      case 'bestSectors':
        return sectorTrio(row.best_sectors, id)
      case 'tyre': {
        const icon = tyreIcon(row.compound)
        return (
          <span key={id} style={{ width: width.tyre }} className="flex shrink-0 items-center justify-end gap-1.5">
            {row.pitted ? (
              <span style={{ fontSize: moveSz }} className="rounded bg-amber-500/20 px-1 font-bold uppercase text-amber-400">pit</span>
            ) : null}
            {icon ? <img src={icon} alt={row.compound ?? ''} style={{ width: iconPx, height: iconPx }} /> : <span style={{ width: iconPx, height: iconPx }} />}
          </span>
        )
      }
      case 'bestTyre': {
        const icon = tyreIcon(row.best_lap_compound)
        return (
          <span key={id} style={{ width: width.bestTyre }} className="flex shrink-0 items-center justify-center">
            {icon ? <img src={icon} alt={row.best_lap_compound ?? ''} style={{ width: iconPx, height: iconPx }} /> : <span style={{ width: iconPx, height: iconPx }} />}
          </span>
        )
      }
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...resolved]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onColumnsChange?.(next)
  }

  function toggle(idx: number) {
    const next = resolved.map((c, i) => (i === idx ? { ...c, visible: !c.visible } : c))
    onColumnsChange?.(next)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-surface p-2">
      {header ? <div className="mb-1 flex-none border-b border-zinc-800 pb-1.5 pr-7">{header}</div> : null}
      {onColumnsChange ? (
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          title="Columns"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M11.49 3.17a1 1 0 00-2.98 0l-.1.6a1 1 0 01-1.4.81l-.55-.25a1 1 0 00-1.27 1.42l.32.52a1 1 0 01-.36 1.4l-.53.3a1 1 0 000 1.74l.53.3a1 1 0 01.36 1.4l-.32.52a1 1 0 001.27 1.42l.55-.25a1 1 0 011.4.8l.1.61a1 1 0 002.98 0l.1-.6a1 1 0 011.4-.81l.55.25a1 1 0 001.27-1.42l-.32-.52a1 1 0 01.36-1.4l.53-.3a1 1 0 000-1.74l-.53-.3a1 1 0 01-.36-1.4l.32-.52a1 1 0 00-1.27-1.42l-.55.25a1 1 0 01-1.4-.8l-.1-.61zM10 13a3 3 0 110-6 3 3 0 010 6z" />
          </svg>
        </button>
      ) : null}

      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-9 z-40 w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Columns</p>
            <ul className="max-h-72 space-y-0.5 overflow-y-auto">
              {resolved.map((col, idx) => (
                <li key={col.id} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-zinc-800/60">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                      title="Move up"
                    >
                      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="currentColor"><path d="M5 2l4 5H1z" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === resolved.length - 1}
                      className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                      title="Move down"
                    >
                      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="currentColor"><path d="M5 8L1 3h8z" /></svg>
                    </button>
                  </div>
                  <span className={`flex-1 text-xs ${col.visible ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {TIMING_COLUMN_LABELS[col.id]}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${col.visible ? 'bg-f1-red/20 text-red-300' : 'bg-zinc-800 text-zinc-500'}`}
                  >
                    {col.visible ? 'Shown' : 'Hidden'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className="flex min-w-full flex-none items-center gap-2 px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          {visible.map((col) => headerCell(col.id))}
        </div>
        <ul ref={listRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent relative flex min-h-0 min-w-full flex-1 flex-col gap-0.5 overflow-y-auto">
          {rows.map((row, idx) => {
            const isSelected = selected === row.number
            return (
              <li key={row.number} data-driver={row.number} className="flex min-h-7 flex-1" style={{ maxHeight: 80 }}>
                <button
                  type="button"
                  onClick={() => onSelect?.(row.number)}
                  style={{ fontSize: fs }}
                  className={['flex h-full w-full items-center gap-2 rounded-md px-2 transition', isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'].join(' ')}
                >
                  {visible.map((col) => bodyCell(col.id, row, idx))}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
