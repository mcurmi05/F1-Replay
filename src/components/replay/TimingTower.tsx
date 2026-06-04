import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import settingsCogIcon from '../../assets/settings_cog.png'
import questionIcon from '../../assets/question.png'
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
  if (tone === 'set') return 'text-yellow-400'
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
  const wrapRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
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
    // Derive per-row height (and thus the font size that sets column widths)
    // from the stable outer container minus the header, not from the rows list.
    // The list shrinks when a horizontal scrollbar appears, which would feed
    // back into the column widths and oscillate the scrollbar on and off.
    const wrap = wrapRef.current
    if (!wrap) return
    const update = () => {
      if (rows.length > 0) {
        const headH = headRef.current?.offsetHeight ?? 0
        setRowH((wrap.offsetHeight - headH) / rows.length)
      }
    }
    update()
    const obs = new ResizeObserver(update)
    obs.observe(wrap)
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
    pos: Math.round(fs * 1.4) + 2,
    interval: Math.round(fs * 4.6),
    leader: Math.round(fs * 4.6),
    lastLap: Math.round(fs * 5),
    sectors: Math.round(fs * 9),
    bestLap: Math.round(fs * 5.2),
    bestSectors: Math.round(fs * 9),
    pbSectors: Math.round(fs * 9),
    tyre: Math.round(fs * 4.4),
    bestTyre: Math.round(fs * 3.4),
  }
  const driverWidth = Math.round(fs * 5) + 19

  function headerCell(id: TimingColumnId) {
    switch (id) {
      case 'pos':
        return <span key={id} style={{ width: width.pos }} className="shrink-0 text-center">P</span>
      case 'driver':
        return <span key={id} style={{ width: driverWidth }} className="shrink-0">Driver</span>
      case 'interval':
        return <span key={id} style={{ width: width.interval }} className="shrink-0 text-center">Interval</span>
      case 'leader':
        return <span key={id} style={{ width: width.leader }} className="shrink-0 text-center">Leader</span>
      case 'lastLap':
        return <span key={id} style={{ width: width.lastLap }} className="shrink-0 text-center">Last</span>
      case 'sectors':
        return <span key={id} style={{ width: width.sectors }} className="shrink-0 text-center">Sectors</span>
      case 'bestLap':
        return <span key={id} style={{ width: width.bestLap }} className="shrink-0 text-center">Best</span>
      case 'bestSectors':
        return <span key={id} style={{ width: width.bestSectors }} className="shrink-0 text-center">Lap Sec</span>
      case 'pbSectors':
        return <span key={id} style={{ width: width.pbSectors }} className="shrink-0 text-center">Best Sec</span>
      case 'tyre':
        return <span key={id} style={{ width: width.tyre }} className="shrink-0 text-center">Tyre</span>
      case 'bestTyre':
        return <span key={id} style={{ width: width.bestTyre }} className="shrink-0 text-center">B.Tyre</span>
    }
  }

  function sectorTrio(cells: SectorCell[] | undefined, key: string, neutralizePb = false) {
    const trio = [0, 1, 2].map((i) => cells?.[i] ?? { value: null, tone: null })
    return (
      <span key={key} style={{ width: width.sectors }} className="flex shrink-0 items-center gap-0.5 rounded bg-zinc-700/50 px-1 py-0.5">
        {trio.map((c, i) => {
          const cls = neutralizePb && c.tone === 'pb' ? 'text-zinc-300' : toneClass(c.tone)
          return (
            <span key={i} style={{ fontSize: fs * 0.72 }} className={`flex-1 text-center font-mono ${cls}`}>
              {formatSector(c.value)}
            </span>
          )
        })}
      </span>
    )
  }

  function bodyCell(id: TimingColumnId, row: TimingTowerRow, idx: number) {
    switch (id) {
      case 'pos':
        return (
          <span key={id} style={{ width: width.pos }} className="shrink-0 text-center font-mono text-zinc-400">
            {row.position ?? '-'}
          </span>
        )
      case 'driver': {
        const move = moves[row.number]
        return (
          <span key={id} style={{ width: driverWidth }} className="flex shrink-0 items-center gap-2">
            <span className="shrink-0 rounded-full" style={{ height: barH, width: barW, backgroundColor: teamColor(row.team_colour) }} />
            <span className="relative shrink-0 font-semibold text-white">
              {row.abbreviation ?? row.number}
              {move ? (
                <span
                  style={{ fontSize: moveSz }}
                  className={['pointer-events-none absolute left-full top-1/2 ml-1 flex -translate-y-1/2 items-center gap-0.5 font-bold leading-none', move.dir === 'up' ? 'text-emerald-500' : 'text-f1-red'].join(' ')}
                >
                  <svg viewBox="0 0 10 10" style={{ width: moveSz, height: moveSz }} fill="currentColor" aria-hidden="true">
                    {move.dir === 'up' ? <path d="M5 1l4 7H1z" /> : <path d="M5 9L1 2h8z" />}
                  </svg>
                  {move.count}
                </span>
              ) : null}
            </span>
            <span className="-mr-1.5 ml-auto flex shrink-0 items-center justify-end overflow-hidden pl-[4px]" style={{ width: Math.round(fs * 2.2) + 4 }}>
              {row.dns ? (
                <span style={{ fontSize: moveSz }} className="shrink-0 rounded bg-zinc-600/30 px-1 font-bold uppercase text-zinc-400">dns</span>
              ) : row.retired ? (
                <span style={{ fontSize: moveSz }} className="shrink-0 rounded bg-f1-red/20 px-1 font-bold uppercase text-f1-red">dnf</span>
              ) : row.pitted ? (
                <span style={{ fontSize: moveSz }} className="shrink-0 rounded bg-amber-500/20 px-1 font-bold uppercase text-amber-400">pit</span>
              ) : null}
            </span>
          </span>
        )
      }
      case 'interval':
        return (
          <span key={id} style={{ width: width.interval, fontSize: fs * 0.82 }} className="shrink-0 text-center font-mono text-zinc-300">
            {idx === 0 ? '' : row.interval ?? '-'}
          </span>
        )
      case 'leader':
        return (
          <span key={id} style={{ width: width.leader, fontSize: fs * 0.82 }} className="shrink-0 text-center font-mono text-zinc-500">
            {idx === 0 ? 'LEADER' : row.gap_leader ?? '-'}
          </span>
        )
      case 'lastLap':
        return (
          <span key={id} style={{ width: width.lastLap, fontSize: fs * 0.82 }} className="shrink-0 text-center font-mono text-zinc-300">
            {row.last_lap !== null ? formatLapTime(row.last_lap) : '-'}
          </span>
        )
      case 'sectors':
        return sectorTrio(row.live_sectors, id)
      case 'bestLap':
        return (
          <span key={id} style={{ width: width.bestLap, fontSize: fs * 0.82 }} className="shrink-0 text-center font-mono text-zinc-200">
            {row.best_lap !== null ? formatLapTime(row.best_lap) : '-'}
          </span>
        )
      case 'bestSectors':
        return sectorTrio(row.best_sectors, id)
      case 'pbSectors':
        return sectorTrio(row.personal_best_sectors, id, true)
      case 'tyre': {
        const icon = tyreIcon(row.compound)
        return (
          <span key={id} style={{ width: width.tyre }} className="flex shrink-0 items-center justify-center gap-1">
            {icon ? <img src={icon} alt={row.compound ?? ''} style={{ width: iconPx, height: iconPx }} /> : <span style={{ width: iconPx, height: iconPx }} />}
            <span style={{ fontSize: fs * 0.7 }} className="font-mono text-zinc-400">{row.tyre_age !== null ? `${row.tyre_age}L` : ''}</span>
          </span>
        )
      }
      case 'bestTyre': {
        const icon = tyreIcon(row.best_lap_compound)
        return (
          <span key={id} style={{ width: width.bestTyre }} className="flex shrink-0 items-center justify-center gap-1">
            {icon ? <img src={icon} alt={row.best_lap_compound ?? ''} style={{ width: iconPx, height: iconPx }} /> : <span style={{ width: iconPx, height: iconPx }} />}
            <span style={{ fontSize: fs * 0.7 }} className="font-mono text-zinc-400">{row.best_lap_tyre_age !== null ? `${row.best_lap_tyre_age}L` : ''}</span>
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
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-surface px-1 py-2">
      {header ? <div className="mb-1 flex-none border-b border-zinc-800 pb-1.5 pr-7">{header}</div> : null}
      {onColumnsChange ? (
        <>
          <div className="group absolute right-9 top-2 z-20">
            <div className="flex h-6 w-6 cursor-help items-center justify-center rounded text-zinc-500 opacity-70 hover:bg-zinc-800 hover:opacity-100">
              <img src={questionIcon} alt="Help" className="h-4 w-4" />
            </div>
            <div className="pointer-events-none absolute right-0 top-8 z-40 hidden w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-[11px] leading-snug text-zinc-300 shadow-xl group-hover:block">
              Use the settings button to edit columns so you can see as much as you want, otherwise shift around other components to widen this timing tower component for a better view.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded text-zinc-500 opacity-70 hover:bg-zinc-800 hover:opacity-100"
            title="Columns"
          >
            <img src={settingsCogIcon} alt="Columns" className="h-4 w-4" />
          </button>
        </>
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

      <div ref={wrapRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent -ml-1 flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-hidden pl-1">
        <div className="flex min-h-0 w-max min-w-full flex-1 flex-col">
          <div ref={headRef} className="flex w-full flex-none items-center gap-2 pl-0.5 pr-1 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            {visible.map((col) => headerCell(col.id))}
          </div>
          <ul ref={listRef} className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent relative flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
            {rows.map((row, idx) => {
              const isSelected = selected === row.number
              return (
                <li key={row.number} data-driver={row.number} className="flex min-h-7 flex-1" style={{ maxHeight: 80 }}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(row.number)}
                    style={{ fontSize: fs }}
                    className={['flex h-full w-full items-center gap-2 rounded-md pl-0.5 pr-1 transition', isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'].join(' ')}
                  >
                    {visible.map((col) => bodyCell(col.id, row, idx))}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
