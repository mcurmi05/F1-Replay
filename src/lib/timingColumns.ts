export type TimingColumnId =
  | 'pos'
  | 'driver'
  | 'interval'
  | 'leader'
  | 'lastLap'
  | 'sectors'
  | 'bestLap'
  | 'bestSectors'
  | 'pbSectors'
  | 'tyre'
  | 'bestTyre'

export interface TimingColumnState {
  id: TimingColumnId
  visible: boolean
}

export const TIMING_COLUMN_LABELS: Record<TimingColumnId, string> = {
  pos: 'Position',
  driver: 'Driver',
  interval: 'Interval',
  leader: 'Leader',
  lastLap: 'Last Lap',
  sectors: 'Sectors (live)',
  bestLap: 'Best Lap',
  bestSectors: 'Best Lap Sectors',
  pbSectors: 'Best Sectors',
  tyre: 'Tyre',
  bestTyre: 'Best Tyre',
}

const CANONICAL_ORDER: TimingColumnId[] = [
  'pos',
  'driver',
  'interval',
  'leader',
  'bestSectors',
  'bestLap',
  'bestTyre',
  'pbSectors',
  'lastLap',
  'sectors',
  'tyre',
]

const RACE_VISIBLE: TimingColumnId[] = [
  'pos',
  'driver',
  'interval',
  'leader',
  'bestSectors',
  'bestLap',
  'bestTyre',
  'pbSectors',
  'lastLap',
  'sectors',
  'tyre',
]
const LAP_VISIBLE: TimingColumnId[] = ['pos', 'driver', 'bestLap', 'pbSectors', 'sectors', 'tyre']

export function defaultColumns(mode: 'race' | 'lap'): TimingColumnState[] {
  const visible = new Set(mode === 'lap' ? LAP_VISIBLE : RACE_VISIBLE)
  const order = mode === 'lap'
    ? ['pos', 'driver', 'bestLap', 'pbSectors', 'bestSectors', 'sectors', 'lastLap', 'tyre', 'bestTyre', 'interval', 'leader'] as TimingColumnId[]
    : CANONICAL_ORDER
  return order.map((id) => ({ id, visible: visible.has(id) }))
}

export function normalizeColumns(
  saved: TimingColumnState[] | null | undefined,
  mode: 'race' | 'lap',
): TimingColumnState[] {
  const fallback = defaultColumns(mode)
  if (!saved || saved.length === 0) return fallback

  const known = new Set(CANONICAL_ORDER)
  const seen = new Set<TimingColumnId>()
  const result: TimingColumnState[] = []
  for (const col of saved) {
    if (!known.has(col.id) || seen.has(col.id)) continue
    seen.add(col.id)
    result.push({ id: col.id, visible: !!col.visible })
  }
  for (const col of fallback) {
    if (!seen.has(col.id)) result.push({ id: col.id, visible: false })
  }
  return result
}
