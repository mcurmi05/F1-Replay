import { useMemo } from 'react'
import { teamColor } from '../../lib/format'
import type { ReplayData } from '../../lib/api/types'

export default function SpeedTrapFeed({
  replay,
  currentTime,
}: {
  replay: ReplayData
  currentTime: number
}) {
  const driverByNumber = useMemo(() => {
    const map = new Map<string, ReplayData['drivers'][number]>()
    for (const d of replay.drivers) map.set(d.number, d)
    return map
  }, [replay.drivers])

  const trap = useMemo(() => {
    const best = new Map<string, number>()
    for (const r of replay.session_bests ?? []) {
      if (r.kind !== 'st' || r.time > currentTime) continue
      const prev = best.get(r.driver)
      if (prev === undefined || r.value > prev) best.set(r.driver, r.value)
    }
    return [...best.entries()]
      .map(([driver, value]) => ({ driver, value }))
      .sort((a, b) => b.value - a.value)
  }, [replay.session_bests, currentTime])

  const tla = (num: string) => driverByNumber.get(num)?.abbreviation ?? num
  const colour = (num: string) => teamColor(driverByNumber.get(num)?.team_colour)

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Speed Trap</p>
      <div className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-xs">
        {trap.length === 0 ? (
          <p className="text-zinc-600">--</p>
        ) : (
          trap.map((row, idx) => (
            <div key={row.driver} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1">
              <span className="w-4 shrink-0 text-zinc-600">{idx + 1}</span>
              <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: colour(row.driver) }} />
              <span className="font-semibold text-zinc-200">{tla(row.driver)}</span>
              <span className={`ml-auto font-mono ${idx === 0 ? 'text-purple-400' : 'text-zinc-300'}`}>
                {Math.round(row.value)}
                <span className="ml-0.5 text-[9px] text-zinc-500">km/h</span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
