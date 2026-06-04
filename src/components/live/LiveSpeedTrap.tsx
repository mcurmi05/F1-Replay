import type { LiveRow } from '../../lib/api/types'

const COLS: { key: 'speed_i1' | 'speed_i2' | 'speed_fl' | 'speed_st'; label: string }[] = [
  { key: 'speed_i1', label: 'I1' },
  { key: 'speed_i2', label: 'I2' },
  { key: 'speed_fl', label: 'FL' },
  { key: 'speed_st', label: 'Trap' },
]

function num(value: string | null): number | null {
  if (!value) return null
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export default function LiveSpeedTrap({ rows }: { rows: LiveRow[] }) {
  const best = COLS.map((c) => {
    let max = 0
    for (const r of rows) {
      const v = num(r[c.key])
      if (v !== null && v > max) max = v
    }
    return max
  })
  const sorted = [...rows].sort((a, b) => (num(b.speed_st) ?? 0) - (num(a.speed_st) ?? 0))

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Speed Trap (km/h)</p>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="text-left font-medium">Driver</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-right font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.driver_number} className="border-t border-zinc-800/60">
                <td className="py-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-1 rounded-full" style={{ backgroundColor: r.team_colour ?? '#71717a' }} />
                    <span className="font-semibold text-zinc-200">{r.abbreviation ?? r.driver_number}</span>
                  </span>
                </td>
                {COLS.map((c, i) => {
                  const v = num(r[c.key])
                  const isBest = v !== null && v > 0 && v === best[i]
                  return (
                    <td key={c.key} className={`py-1 text-right font-mono ${isBest ? 'font-semibold text-purple-400' : 'text-zinc-300'}`}>
                      {v ?? '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
