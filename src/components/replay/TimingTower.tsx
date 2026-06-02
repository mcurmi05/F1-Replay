import { compoundInfo } from '../../lib/replay'
import { teamColor } from '../../lib/format'
import type { TowerRow } from '../../lib/replay'

export default function TimingTower({
  rows,
  selected,
  onSelect,
}: {
  rows: TowerRow[]
  selected: string | null
  onSelect: (driver: string) => void
}) {
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
      <ul className="space-y-0.5">
        {rows.map((row, idx) => {
          const tyre = compoundInfo(row.compound)
          const isSelected = selected === row.number
          return (
            <li key={row.number}>
              <button
                type="button"
                onClick={() => onSelect(row.number)}
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
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold"
                    style={{ color: tyre.color, borderColor: tyre.color }}
                  >
                    {tyre.letter}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
