import { useState } from 'react'
import { createPortal } from 'react-dom'
import questionIcon from '../../assets/question.png'
import { teamColor } from '../../lib/format'
import type { LivePitTime, LiveRow } from '../../lib/api/types'

function getDriverInfo(driverNumber: string, rows: LiveRow[]): { abbr: string; color: string } {
  const row = rows.find((r) => r.driver_number === driverNumber)
  return {
    abbr: row?.abbreviation || driverNumber,
    color: teamColor(row?.team_colour),
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
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pit Stops</p>
        <div
          className="relative"
          onMouseEnter={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setTip({ x: r.left, y: r.bottom + 6 })
          }}
          onMouseLeave={() => setTip(null)}
        >
          <div className="flex h-5 w-5 cursor-help items-center justify-center rounded text-zinc-500 opacity-70 hover:bg-zinc-800 hover:opacity-100">
            <img src={questionIcon} alt="Help" className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
      {tip ? createPortal(
        <div
          style={{ position: 'fixed', left: tip.x, top: tip.y, zIndex: 60 }}
          className="pointer-events-none w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-[11px] leading-snug text-zinc-300 shadow-xl"
        >
          The F1 api live data stream doesn't persist pit stop data so only recent pit stops are shown, not the entire history of pit stops in this session.
        </div>,
        document.body,
      ) : null}
      <div className="thin-scroll mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-zinc-600">No recent pit stops</p>
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
