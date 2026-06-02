import { useLayoutEffect, useRef } from 'react'

import { teamColor } from '../../lib/format'
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
}

export default function TimingTower({
  rows,
  selected = null,
  onSelect,
}: {
  rows: TimingTowerRow[]
  selected?: string | null
  onSelect?: (driver: string) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const tops = useRef<Map<string, number>>(new Map())
  const order = useRef<string>('')

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

  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-2">
      <div className="flex items-center gap-2 px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        <span className="w-5 text-right">P</span>
        <span className="w-1 shrink-0" />
        <span>Driver</span>
        <span className="ml-auto w-16 text-right">Interval</span>
        <span className="w-16 text-right">Leader</span>
        <span className="w-12" />
      </div>
      <ul ref={listRef} className="relative space-y-0.5">
        {rows.map((row, idx) => {
          const icon = tyreIcon(row.compound)
          const isSelected = selected === row.number
          return (
            <li key={row.number} data-driver={row.number}>
              <button
                type="button"
                onClick={() => onSelect?.(row.number)}
                className={[
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition',
                  isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50',
                ].join(' ')}
              >
                <span className="w-5 text-right font-mono text-zinc-400">{row.position ?? '-'}</span>
                <span
                  className="h-4 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: teamColor(row.team_colour) }}
                />
                <span className="font-semibold text-white">{row.abbreviation ?? row.number}</span>
                <span className="ml-auto w-16 text-right font-mono text-xs text-zinc-300">
                  {idx === 0 ? '' : row.interval ?? '-'}
                </span>
                <span className="w-16 text-right font-mono text-xs text-zinc-500">
                  {idx === 0 ? 'LEADER' : row.gap_leader ?? '-'}
                </span>
                <span className="flex w-12 items-center justify-end gap-1.5">
                  {row.pitted ? (
                    <span className="rounded bg-amber-500/20 px-1 text-[10px] font-bold uppercase text-amber-400">
                      pit
                    </span>
                  ) : null}
                  {icon ? (
                    <img src={icon} alt={row.compound ?? ''} className="h-5 w-5" />
                  ) : (
                    <span className="h-5 w-5" />
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
