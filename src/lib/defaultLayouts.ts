import type { Layout } from 'react-grid-layout'
import type { TimingColumnState } from './timingColumns'

export interface SessionDefault {
  layout: Layout
  hiddenPanels: string[]
  timingColumns: TimingColumnState[]
}

const PRACTICE: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 35, h: 60, minW: 20, minH: 20 },
    { i: 'raceControl', x: 65, y: 10, w: 20, h: 21, minW: 10, minH: 10 },
    { i: 'pitStops', x: 65, y: 31, w: 20, h: 18, minW: 10, minH: 10 },
    { i: 'telemetry', x: 35, y: 0, w: 30, h: 20, minW: 20, minH: 10 },
    { i: 'timingTower', x: 85, y: 0, w: 75, h: 70, minW: 30, minH: 30 },
    { i: 'teamRadio', x: 35, y: 40, w: 30, h: 20, minW: 15, minH: 10 },
    { i: 'sessionBests', x: 35, y: 20, w: 30, h: 20, minW: 20, minH: 10 },
    { i: 'speedTrap', x: 65, y: 49, w: 20, h: 11, minW: 15, minH: 10 },
    { i: 'commentary', x: 65, y: 0, w: 20, h: 10, minW: 15, minH: 10 },
    { i: 'playback', x: 0, y: 60, w: 85, h: 10, minW: 30, minH: 10 },
  ],
  hiddenPanels: [],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'bestSectors', visible: true },
    { id: 'bestLap', visible: true },
    { id: 'bestTyre', visible: false },
    { id: 'interval', visible: true },
    { id: 'pbSectors', visible: true },
    { id: 'lastLap', visible: true },
    { id: 'sectors', visible: true },
    { id: 'tyre', visible: true },
    { id: 'leader', visible: false },
  ],
}

const QUALIFYING: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 35, h: 60, minW: 20, minH: 20 },
    { i: 'raceControl', x: 65, y: 10, w: 20, h: 21, minW: 10, minH: 10 },
    { i: 'pitStops', x: 65, y: 31, w: 20, h: 18, minW: 10, minH: 10 },
    { i: 'telemetry', x: 35, y: 0, w: 30, h: 20, minW: 20, minH: 10 },
    { i: 'timingTower', x: 85, y: 0, w: 75, h: 70, minW: 30, minH: 30 },
    { i: 'teamRadio', x: 35, y: 40, w: 30, h: 20, minW: 15, minH: 10 },
    { i: 'sessionBests', x: 35, y: 20, w: 30, h: 20, minW: 20, minH: 10 },
    { i: 'speedTrap', x: 65, y: 49, w: 20, h: 11, minW: 15, minH: 10 },
    { i: 'commentary', x: 65, y: 0, w: 20, h: 10, minW: 15, minH: 10 },
    { i: 'playback', x: 0, y: 60, w: 85, h: 10, minW: 30, minH: 10 },
  ],
  hiddenPanels: [],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'bestSectors', visible: true },
    { id: 'bestLap', visible: true },
    { id: 'interval', visible: true },
    { id: 'pbSectors', visible: true },
    { id: 'sectors', visible: true },
    { id: 'lastLap', visible: true },
    { id: 'tyre', visible: true },
    { id: 'bestTyre', visible: false },
    { id: 'leader', visible: false },
  ],
}

const RACE: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 35, h: 60, minW: 20, minH: 20 },
    { i: 'raceControl', x: 65, y: 10, w: 25, h: 21, minW: 10, minH: 10 },
    { i: 'pitStops', x: 65, y: 31, w: 25, h: 18, minW: 10, minH: 10 },
    { i: 'telemetry', x: 35, y: 0, w: 30, h: 20, minW: 20, minH: 10 },
    { i: 'timingTower', x: 90, y: 0, w: 70, h: 70, minW: 30, minH: 30 },
    { i: 'teamRadio', x: 35, y: 40, w: 30, h: 20, minW: 15, minH: 10 },
    { i: 'sessionBests', x: 35, y: 20, w: 30, h: 20, minW: 20, minH: 10 },
    { i: 'speedTrap', x: 65, y: 49, w: 24, h: 11, minW: 15, minH: 10 },
    { i: 'commentary', x: 65, y: 0, w: 25, h: 10, minW: 15, minH: 10 },
    { i: 'playback', x: 0, y: 60, w: 90, h: 10, minW: 30, minH: 10 },
  ],
  hiddenPanels: [],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'interval', visible: true },
    { id: 'leader', visible: true },
    { id: 'bestSectors', visible: true },
    { id: 'pbSectors', visible: false },
    { id: 'bestLap', visible: true },
    { id: 'bestTyre', visible: false },
    { id: 'lastLap', visible: true },
    { id: 'sectors', visible: true },
    { id: 'tyre', visible: true },
  ],
}

export type LayoutCategory =
  | 'practice'
  | 'qualifying'
  | 'race'
  | 'live-practice'
  | 'live-qualifying'
  | 'live-race'

export const LIVE: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 50, h: 48, minW: 20, minH: 20 },
    { i: 'telemetry', x: 0, y: 48, w: 50, h: 22, minW: 18, minH: 12 },
    { i: 'raceControl', x: 50, y: 0, w: 55, h: 22, minW: 15, minH: 10 },
    { i: 'pitStops', x: 50, y: 22, w: 27, h: 24, minW: 12, minH: 10 },
    { i: 'speedTrap', x: 77, y: 22, w: 28, h: 24, minW: 12, minH: 10 },
    { i: 'teamRadio', x: 50, y: 46, w: 55, h: 24, minW: 15, minH: 10 },
    { i: 'timingTower', x: 105, y: 0, w: 55, h: 70, minW: 30, minH: 30 },
  ],
  hiddenPanels: [],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'interval', visible: true },
    { id: 'leader', visible: true },
    { id: 'bestLap', visible: true },
    { id: 'pbSectors', visible: true },
    { id: 'sectors', visible: true },
    { id: 'lastLap', visible: true },
    { id: 'tyre', visible: true },
    { id: 'bestSectors', visible: false },
    { id: 'bestTyre', visible: false },
  ],
}

export function sessionCategory(session: string): 'practice' | 'qualifying' | 'race' {
  if (session === 'R' || session === 'Sprint') return 'race'
  if (session === 'Q' || session === 'SQ') return 'qualifying'
  return 'practice'
}

export function liveCategoryFor(session: string): LayoutCategory {
  return `live-${sessionCategory(session)}` as LayoutCategory
}

export function defaultsFor(session: string): SessionDefault {
  if (session === 'R' || session === 'Sprint') return RACE
  if (session === 'Q' || session === 'SQ') return QUALIFYING
  return PRACTICE
}
