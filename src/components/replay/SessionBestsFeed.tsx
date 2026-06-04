import { useMemo } from 'react'
import { formatLapTime, teamColor } from '../../lib/format'
import type { ReplayData } from '../../lib/api/types'

type SectorKind = 's1' | 's2' | 's3'

function formatSector(value: number): string {
  return value.toFixed(3)
}

function sectorClass(value: number | null, sessionBest: number | null, personalBest: number | null): string {
  if (value === null) return 'text-zinc-600'
  const eps = 1e-4
  if (sessionBest !== null && Math.abs(value - sessionBest) < eps) return 'text-purple-400'
  if (personalBest !== null && Math.abs(value - personalBest) < eps) return 'text-emerald-400'
  return 'text-yellow-400'
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

  const { fastestLap, sectorBest, personalSectors } = useMemo(() => {
    const personal = new Map<string, number>()
    let fastestLap: { driver: string; value: number; sectors: (number | null)[] } | null = null
    for (const r of replay.session_bests ?? []) {
      if (r.time > currentTime) continue
      if (r.kind === 'lap') {
        if (!fastestLap || r.value < fastestLap.value) {
          fastestLap = { driver: r.driver, value: r.value, sectors: r.sectors ?? [null, null, null] }
        }
        continue
      }
      if (r.kind === 'st') continue
      const key = `${r.driver}|${r.kind}`
      const prev = personal.get(key)
      if (prev === undefined || r.value < prev) personal.set(key, r.value)
    }

    const sectorBest: Record<SectorKind, { driver: string; value: number } | null> = {
      s1: null, s2: null, s3: null,
    }
    for (const [key, value] of personal) {
      const [driver, kind] = key.split('|') as [string, SectorKind]
      const cur = sectorBest[kind]
      if (!cur || value < cur.value) sectorBest[kind] = { driver, value }
    }

    const kinds: SectorKind[] = ['s1', 's2', 's3']
    const personalSectors: (number | null)[] = fastestLap
      ? kinds.map((k) => personal.get(`${fastestLap!.driver}|${k}`) ?? null)
      : [null, null, null]

    return { fastestLap, sectorBest, personalSectors }
  }, [replay.session_bests, currentTime])

  const tla = (num: string) => driverByNumber.get(num)?.abbreviation ?? num
  const colour = (num: string) => teamColor(driverByNumber.get(num)?.team_colour)

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Session Bests</p>
      <div className="scrollbar scrollbar-thumb-zinc-700 scrollbar-track-transparent mt-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-xs">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fastest Lap</p>
          {fastestLap ? (
            <div className="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-1">
              <div className="flex items-center gap-2">
                <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: colour(fastestLap.driver) }} />
                <span className="font-semibold text-zinc-200">{tla(fastestLap.driver)}</span>
                <span className="ml-auto font-mono text-purple-400">{formatLapTime(fastestLap.value)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 font-mono text-[10px]">
                {fastestLap.sectors.map((s, i) => {
                  const kinds: SectorKind[] = ['s1', 's2', 's3']
                  const cls = sectorClass(s, sectorBest[kinds[i]]?.value ?? null, personalSectors[i])
                  return (
                    <span key={i} className={`flex-1 rounded bg-zinc-800/60 px-1 py-0.5 text-center ${cls}`}>
                      {s !== null ? formatSector(s) : '--'}
                    </span>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center rounded border border-purple-500/40 bg-purple-500/10 px-2 py-1">
              <span className="ml-auto text-zinc-600">--</span>
            </div>
          )}
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
      </div>
    </div>
  )
}
