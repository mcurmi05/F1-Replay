import { defaultColumns } from './timingColumns'
import type { TimingColumnId, TimingColumnState } from './timingColumns'

// On a phone the timing tower is narrow, so it shows a trimmed set of columns by
// default. The chosen set is shared by the live and replay boards and persisted
// under one key.
export const MOBILE_COLUMNS_KEY = 'f1replay.liveMobileColumns.v1'
const MOBILE_RACE_VISIBLE: TimingColumnId[] = ['pos', 'driver', 'interval', 'lastLap', 'tyre']
const MOBILE_LAP_VISIBLE: TimingColumnId[] = ['pos', 'driver', 'bestLap', 'lastLap', 'tyre']

export function mobileDefaultColumns(mode: 'race' | 'lap'): TimingColumnState[] {
  const visible = new Set(mode === 'lap' ? MOBILE_LAP_VISIBLE : MOBILE_RACE_VISIBLE)
  return defaultColumns(mode).map((c) => ({ id: c.id, visible: visible.has(c.id) }))
}

export function loadMobileColumns(): TimingColumnState[] | null {
  try {
    const raw = localStorage.getItem(MOBILE_COLUMNS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as TimingColumnState[]) : null
  } catch {
    return null
  }
}
