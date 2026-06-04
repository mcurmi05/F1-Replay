import type { LiveRow } from '../../lib/api/types'

function Bar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className="font-mono">{value !== null ? `${Math.round(pct)}%` : '-'}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function LiveTelemetry({ row }: { row: LiveRow | null }) {
  const drsOpen = (row?.drs ?? 0) >= 10
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Telemetry</p>
        {row ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="h-3 w-1 rounded-full" style={{ backgroundColor: row.team_colour ?? '#71717a' }} />
            <span className="font-semibold text-zinc-200">{row.abbreviation ?? row.driver_number}</span>
          </span>
        ) : null}
      </div>
      {!row ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-zinc-500">
          Select a driver to view telemetry
        </div>
      ) : (
        <div className="mt-2 flex min-h-0 flex-1 flex-col justify-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-white">{row.speed ?? '-'}</span>
            <span className="text-xs text-zinc-500">km/h</span>
            <span className="ml-auto flex items-center gap-2 text-sm">
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono font-semibold text-zinc-200">{row.gear ?? '-'}</span>
              <span className="font-mono text-xs text-zinc-400">{row.rpm ?? '-'}<span className="text-zinc-600"> rpm</span></span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${drsOpen ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-600'}`}>DRS</span>
            </span>
          </div>
          <Bar label="Throttle" value={row.throttle} color="bg-emerald-500" />
          <Bar label="Brake" value={row.brake} color="bg-f1-red" />
        </div>
      )}
    </div>
  )
}
