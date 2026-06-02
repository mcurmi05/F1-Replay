import type { LiveRow } from '../../lib/api/types'

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: 'bg-red-600',
  MEDIUM: 'bg-yellow-400',
  HARD: 'bg-white text-black',
  INTERMEDIATE: 'bg-green-500',
  WET: 'bg-blue-600',
}

function CompoundBadge({ compound }: { compound: string | null }) {
  if (!compound) return null
  const bgColor = COMPOUND_COLORS[compound] || 'bg-zinc-600'
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${bgColor}`}>
      {compound.slice(0, 1)}
    </span>
  )
}

function SectorCell({ value, pb }: { value: string | null; pb: boolean }) {
  return (
    <span className={pb ? 'font-semibold text-purple-400' : 'text-zinc-400'}>
      {value || '—'}
    </span>
  )
}

function SpeedCell({ value, pb }: { value: string | null; pb: boolean }) {
  return (
    <span className={pb ? 'font-semibold text-purple-400' : 'text-zinc-400'}>
      {value || '—'}
    </span>
  )
}

export default function LiveTimingTable({ rows }: { rows: LiveRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-surface">
      <table className="w-full text-xs">
        <thead className="border-b border-zinc-800 bg-zinc-900/50">
          <tr>
            <th className="px-2 py-2 text-left font-semibold text-zinc-400">P</th>
            <th className="px-2 py-2 text-left font-semibold text-zinc-400">Driver</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">Gap</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">Int</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">S1</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">S2</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">S3</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">I1</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">I2</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">FL</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">ST</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">Last</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">Best</th>
            <th className="px-2 py-2 text-center font-semibold text-zinc-400">Tyre</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">Age</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-400">Pits</th>
            <th className="px-2 py-2 text-center font-semibold text-zinc-400">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.driver_number}
              className={idx % 2 === 0 ? 'bg-zinc-900/20' : 'bg-zinc-900/40'}
            >
              <td className="px-2 py-1.5 font-mono font-semibold text-white">{row.position ?? '-'}</td>
              <td className="px-2 py-1.5 font-semibold text-white">{row.abbreviation ?? '-'}</td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">{row.gap || '—'}</td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">{row.interval || '—'}</td>
              <td className="px-2 py-1.5 text-right font-mono">
                <SectorCell value={row.sector_1} pb={row.sector_1_pb} />
              </td>
              <td className="px-2 py-1.5 text-right font-mono">
                <SectorCell value={row.sector_2} pb={row.sector_2_pb} />
              </td>
              <td className="px-2 py-1.5 text-right font-mono">
                <SectorCell value={row.sector_3} pb={row.sector_3_pb} />
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">
                {row.speed_i1 || '—'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">
                {row.speed_i2 || '—'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">
                {row.speed_fl || '—'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">
                {row.speed_st || '—'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">{row.last_lap || '—'}</td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">{row.best_lap || '—'}</td>
              <td className="px-2 py-1.5 text-center">
                <CompoundBadge compound={row.compound} />
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">
                {row.tyre_age ?? '—'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-zinc-400">
                {row.pit_stops ?? '—'}
              </td>
              <td className="px-2 py-1.5 text-center">
                {row.in_pit ? (
                  <span className="inline-block rounded bg-yellow-900/30 px-1.5 py-0.5 text-xs font-semibold text-yellow-400">
                    PIT
                  </span>
                ) : row.retired ? (
                  <span className="inline-block rounded bg-red-900/30 px-1.5 py-0.5 text-xs font-semibold text-red-400">
                    OUT
                  </span>
                ) : row.status ? (
                  <span className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-semibold text-zinc-400">
                    {row.status}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
