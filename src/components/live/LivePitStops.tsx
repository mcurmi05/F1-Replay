import type { LivePitTime, LiveRow } from '../../lib/api/types'

function getDriverInfo(driverNumber: string, rows: LiveRow[]): { abbr: string; color: string } {
  const row = rows.find((r) => r.driver_number === driverNumber)
  return {
    abbr: row?.abbreviation || driverNumber,
    color: row?.team_colour || '#71717a',
  }
}

export default function LivePitStops({
  times,
  drivers,
}: {
  times: LivePitTime[]
  drivers: LiveRow[]
}) {
  const sorted = [...times].sort((a, b) => (b.lap ?? 0) - (a.lap ?? 0))
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pit Stops</p>
      <div className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-zinc-600">No pit stops yet</p>
        ) : (
          sorted.map((pit, idx) => {
            const driver = getDriverInfo(pit.driver_number, drivers)
            return (
              <div
                key={`${pit.driver_number}-${pit.lap}-${idx}`}
                className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/30 px-2 py-1.5"
              >
                <span
                  className="inline-block h-5 w-8 rounded text-center text-xs font-bold leading-5 text-white"
                  style={{ backgroundColor: driver.color }}
                >
                  {driver.abbr}
                </span>
                {pit.lap !== null ? (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                    L{pit.lap}
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-sm text-zinc-200">
                  {pit.duration ? `${pit.duration}s` : '-'}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
