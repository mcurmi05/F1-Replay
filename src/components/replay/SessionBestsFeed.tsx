import { useMemo } from 'react'
import { formatLapTime, teamColor } from '../../lib/format'
import type { ReplayData, SessionBestRecord } from '../../lib/api/types'

type Kind = SessionBestRecord['kind']
type SectorKind = 's1' | 's2' | 's3'

function formatSector(value: number): string {
  return value.toFixed(3)
}

const SECTOR_ROWS: { kind: SectorKind; label: string }[] = [
  { kind: 's1', label: 'S1' },
  { kind: 's2', label: 'S2' },
  { kind: 's3', label: 'S3' },
]

export default function SessionBestsFeed({
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

  const { fastestLap, sectorBest, trap } = useMemo(() => {
    const personal = new Map<string, number>()
    for (const r of replay.session_bests ?? []) {
      if (r.time > currentTime) continue
      const key = `${r.driver}|${r.kind}`
      const prev = personal.get(key)
      const better = prev === undefined || (r.kind === 'st' ? r.value > prev : r.value < prev)
      if (better) personal.set(key, r.value)
    }

    const sectorBest: Record<SectorKind, { driver: string; value: number } | null> = {
      s1: null, s2: null, s3: null,
    }
    const trapList: { driver: string; value: number }[] = []
    let fastestLap: { driver: string; value: number } | null = null
    for (const [key, value] of personal) {
      const [driver, kind] = key.split('|') as [string, Kind]
      if (kind === 'st') {
        trapList.push({ driver, value })
      } else if (kind === 'lap') {
        if (!fastestLap || value < fastestLap.value) fastestLap = { driver, value }
      } else {
        const cur = sectorBest[kind]
        if (!cur || value < cur.value) sectorBest[kind] = { driver, value }
      }
    }
    trapList.sort((a, b) => b.value - a.value)
    return { fastestLap, sectorBest, trap: trapList }
  }, [replay.session_bests, currentTime])

  const tla = (num: string) => driverByNumber.get(num)?.abbreviation ?? num
  const colour = (num: string) => teamColor(driverByNumber.get(num)?.team_colour)

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Session Bests</p>
      <div className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-xs">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fastest Lap</p>
          <div className="flex items-center gap-2 rounded border border-purple-500/40 bg-purple-500/10 px-2 py-1">
            {fastestLap ? (
              <>
                <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: colour(fastestLap.driver) }} />
                <span className="font-semibold text-zinc-200">{tla(fastestLap.driver)}</span>
                <span className="ml-auto font-mono text-purple-400">{formatLapTime(fastestLap.value)}</span>
              </>
            ) : (
              <span className="ml-auto text-zinc-600">--</span>
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Best Sectors</p>
          <div className="flex flex-col gap-1">
            {SECTOR_ROWS.map(({ kind, label }) => {
              const best = sectorBest[kind]
              return (
                <div key={kind} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1">
                  <span className="w-6 shrink-0 font-semibold text-zinc-500">{label}</span>
                  {best ? (
                    <>
                      <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: colour(best.driver) }} />
                      <span className="font-semibold text-zinc-200">{tla(best.driver)}</span>
                      <span className="ml-auto font-mono text-purple-400">{formatSector(best.value)}</span>
                    </>
                  ) : (
                    <span className="ml-auto text-zinc-600">--</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Speed Trap</p>
          {trap.length === 0 ? (
            <p className="text-zinc-600">--</p>
          ) : (
            <div className="flex flex-col gap-1">
              {trap.map((row, idx) => (
                <div key={row.driver} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1">
                  <span className="w-4 shrink-0 text-zinc-600">{idx + 1}</span>
                  <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: colour(row.driver) }} />
                  <span className="font-semibold text-zinc-200">{tla(row.driver)}</span>
                  <span className={`ml-auto font-mono ${idx === 0 ? 'text-purple-400' : 'text-zinc-300'}`}>
                    {Math.round(row.value)}
                    <span className="ml-0.5 text-[9px] text-zinc-500">km/h</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
