import type { Layout } from 'react-grid-layout'
import type { TimingColumnState } from './timingColumns'

export interface SessionDefault {
  layout: Layout
  hiddenPanels: string[]
  timingColumns: TimingColumnState[]
}

const PRACTICE: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 33, h: 43, minW: 20, minH: 20 },
    { i: 'raceControl', x: 57, y: 10, w: 22, h: 28, minW: 10, minH: 10 },
    { i: 'pitStops', x: 57, y: 38, w: 22, h: 22, minW: 10, minH: 10 },
    { i: 'telemetry', x: 0, y: 43, w: 33, h: 17, minW: 20, minH: 10 },
    { i: 'timingTower', x: 79, y: 0, w: 81, h: 70, minW: 30, minH: 30 },
    { i: 'teamRadio', x: 33, y: 38, w: 24, h: 22, minW: 15, minH: 10 },
    { i: 'sessionBests', x: 33, y: 18, w: 24, h: 20, minW: 20, minH: 10 },
    { i: 'speedTrap', x: 33, y: 0, w: 24, h: 18, minW: 15, minH: 10 },
    { i: 'commentary', x: 57, y: 0, w: 22, h: 10, minW: 15, minH: 10 },
    { i: 'playback', x: 0, y: 60, w: 79, h: 10, minW: 30, minH: 10 },
  ],
  hiddenPanels: [],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'interval', visible: true },
    { id: 'leader', visible: true },
    { id: 'bestSectors', visible: true },
    { id: 'bestLap', visible: true },
    { id: 'bestTyre', visible: false },
    { id: 'pbSectors', visible: true },
    { id: 'lastLap', visible: true },
    { id: 'sectors', visible: true },
    { id: 'tyre', visible: true },
  ],
}

const QUALIFYING: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 33, h: 43, minW: 20, minH: 20 },
    { i: 'raceControl', x: 57, y: 10, w: 22, h: 28, minW: 10, minH: 10 },
    { i: 'pitStops', x: 57, y: 38, w: 22, h: 22, minW: 10, minH: 10 },
    { i: 'telemetry', x: 0, y: 43, w: 33, h: 17, minW: 20, minH: 10 },
    { i: 'timingTower', x: 79, y: 0, w: 81, h: 70, minW: 30, minH: 30 },
    { i: 'teamRadio', x: 33, y: 38, w: 24, h: 22, minW: 15, minH: 10 },
    { i: 'sessionBests', x: 33, y: 18, w: 24, h: 20, minW: 20, minH: 10 },
    { i: 'speedTrap', x: 33, y: 0, w: 24, h: 18, minW: 15, minH: 10 },
    { i: 'commentary', x: 57, y: 0, w: 22, h: 10, minW: 15, minH: 10 },
    { i: 'playback', x: 0, y: 60, w: 79, h: 10, minW: 30, minH: 10 },
  ],
  hiddenPanels: [],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'interval', visible: true },
    { id: 'leader', visible: true },
    { id: 'bestSectors', visible: true },
    { id: 'bestLap', visible: true },
    { id: 'pbSectors', visible: true },
    { id: 'lastLap', visible: true },
    { id: 'sectors', visible: true },
    { id: 'tyre', visible: true },
    { id: 'bestTyre', visible: false },
  ],
}

const RACE: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 33, h: 43, minW: 20, minH: 20 },
    { i: 'raceControl', x: 57, y: 10, w: 22, h: 28, minW: 10, minH: 10 },
    { i: 'pitStops', x: 57, y: 38, w: 22, h: 22, minW: 10, minH: 10 },
    { i: 'telemetry', x: 0, y: 43, w: 33, h: 17, minW: 20, minH: 10 },
    { i: 'timingTower', x: 79, y: 0, w: 81, h: 70, minW: 30, minH: 30 },
    { i: 'teamRadio', x: 33, y: 38, w: 24, h: 22, minW: 15, minH: 10 },
    { i: 'sessionBests', x: 33, y: 18, w: 24, h: 20, minW: 20, minH: 10 },
    { i: 'speedTrap', x: 33, y: 0, w: 24, h: 18, minW: 15, minH: 10 },
    { i: 'commentary', x: 57, y: 0, w: 22, h: 10, minW: 15, minH: 10 },
    { i: 'playback', x: 0, y: 60, w: 79, h: 10, minW: 30, minH: 10 },
  ],
  hiddenPanels: [],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'interval', visible: true },
    { id: 'leader', visible: true },
    { id: 'bestSectors', visible: true },
    { id: 'bestLap', visible: true },
    { id: 'pbSectors', visible: true },
    { id: 'bestTyre', visible: false },
    { id: 'lastLap', visible: true },
    { id: 'sectors', visible: true },
    { id: 'tyre', visible: true },
  ],
}

const LIVE_NONRACE: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 33, h: 53, minW: 20, minH: 20 },
    { i: 'raceControl', x: 57, y: 10, w: 22, h: 35, minW: 10, minH: 10 },
    { i: 'pitStops', x: 57, y: 45, w: 22, h: 25, minW: 10, minH: 10 },
    { i: 'telemetry', x: 0, y: 53, w: 33, h: 17, minW: 20, minH: 10 },
    { i: 'timingTower', x: 79, y: 0, w: 81, h: 70, minW: 30, minH: 30 },
    { i: 'teamRadio', x: 33, y: 45, w: 24, h: 25, minW: 15, minH: 10 },
    { i: 'sessionBests', x: 33, y: 25, w: 24, h: 20, minW: 20, minH: 10 },
    { i: 'speedTrap', x: 33, y: 0, w: 24, h: 25, minW: 15, minH: 10 },
    { i: 'commentary', x: 57, y: 0, w: 22, h: 10, minW: 15, minH: 10 },
    { i: 'playback', x: 0, y: 60, w: 79, h: 10, minW: 30, minH: 10 },
    { i: 'championship', x: 0, y: 70, w: 50, h: 28, minW: 20, minH: 12 },
  ],
  hiddenPanels: ['championship'],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'interval', visible: true },
    { id: 'leader', visible: true },
    { id: 'bestSectors', visible: true },
    { id: 'bestLap', visible: true },
    { id: 'pbSectors', visible: true },
    { id: 'bestTyre', visible: false },
    { id: 'lastLap', visible: true },
    { id: 'sectors', visible: true },
    { id: 'tyre', visible: true },
  ],
}

const LIVE_RACE: SessionDefault = {
  layout: [
    { i: 'trackmap', x: 0, y: 0, w: 33, h: 53, minW: 20, minH: 20 },
    { i: 'raceControl', x: 33, y: 20, w: 21, h: 33, minW: 10, minH: 10 },
    { i: 'pitStops', x: 54, y: 53, w: 21, h: 17, minW: 10, minH: 10 },
    { i: 'telemetry', x: 0, y: 53, w: 33, h: 17, minW: 20, minH: 10 },
    { i: 'timingTower', x: 75, y: 0, w: 85, h: 70, minW: 30, minH: 30 },
    { i: 'teamRadio', x: 54, y: 26, w: 21, h: 27, minW: 15, minH: 10 },
    { i: 'sessionBests', x: 33, y: 0, w: 21, h: 20, minW: 20, minH: 10 },
    { i: 'speedTrap', x: 33, y: 53, w: 21, h: 17, minW: 15, minH: 10 },
    { i: 'commentary', x: 54, y: 0, w: 21, h: 10, minW: 15, minH: 10 },
    { i: 'championship', x: 54, y: 10, w: 21, h: 16, minW: 20, minH: 12 },
    { i: 'playback', x: 0, y: 60, w: 79, h: 10, minW: 30, minH: 10 },
  ],
  hiddenPanels: [],
  timingColumns: [
    { id: 'pos', visible: true },
    { id: 'driver', visible: true },
    { id: 'interval', visible: true },
    { id: 'leader', visible: true },
    { id: 'bestSectors', visible: true },
    { id: 'bestLap', visible: true },
    { id: 'pbSectors', visible: true },
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

export const CATEGORY_ORDER: LayoutCategory[] = [
  'practice',
  'qualifying',
  'race',
  'live-practice',
  'live-qualifying',
  'live-race',
]

export const CATEGORY_LABELS: Record<LayoutCategory, string> = {
  practice: 'Practice',
  qualifying: 'Qualifying',
  race: 'Race',
  'live-practice': 'Live · Practice',
  'live-qualifying': 'Live · Qualifying',
  'live-race': 'Live · Race',
}

export const CATEGORY_DEFAULTS: Record<LayoutCategory, SessionDefault> = {
  practice: PRACTICE,
  qualifying: QUALIFYING,
  race: RACE,
  'live-practice': LIVE_NONRACE,
  'live-qualifying': LIVE_NONRACE,
  'live-race': LIVE_RACE,
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

export function liveDefaultsFor(session: string): SessionDefault {
  const category = sessionCategory(session)
  if (category === 'race') return LIVE_RACE
  return LIVE_NONRACE
}
