import type { Layout } from 'react-grid-layout'
import type { TimingColumnState } from './timingColumns'

// Built-in default panel arrangements per session type. Layouts are expressed in
// COLS (160) grid units, matching what the "Save layout" export produces, so they
// are used as-is without rescaling. defaultsFor() maps a session code to one of
// these. ReplayViewer seeds these on first open of a session type; user edits
// persist per type and "Default" restores the relevant bundle here.

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

export type LayoutCategory = 'practice' | 'qualifying' | 'race'

export function sessionCategory(session: string): LayoutCategory {
  if (session === 'R' || session === 'Sprint') return 'race'
  if (session === 'Q' || session === 'SQ') return 'qualifying'
  return 'practice'
}

export function defaultsFor(session: string): SessionDefault {
  if (session === 'R' || session === 'Sprint') return RACE
  if (session === 'Q' || session === 'SQ') return QUALIFYING
  return PRACTICE
}
