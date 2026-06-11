import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import CommentaryAudio from '../components/replay/CommentaryAudio'
import PanelGrid, { LAYOUT_STORAGE_KEY } from '../components/replay/PanelGrid'
import RaceControlFeed from '../components/replay/RaceControlFeed'
import ReplayClock from '../components/replay/ReplayClock'
import SessionBestsFeed from '../components/replay/SessionBestsFeed'
import SpeedTrapFeed from '../components/replay/SpeedTrapFeed'
import TeamRadioFeed from '../components/replay/TeamRadioFeed'
import TimingTower from '../components/replay/TimingTower'
import type { TimingTowerRow } from '../components/replay/TimingTower'
import TrackMap from '../components/replay/TrackMap'
import LiveAuthOverlay from '../components/live/LiveAuthOverlay'
import LivePitStops from '../components/live/LivePitStops'
import LiveTelemetry from '../components/live/LiveTelemetry'
import ChampionshipPrediction from '../components/live/ChampionshipPrediction'
import { useLive } from '../hooks/useApi'
import { useIsMobile, useMobileColumns } from '../hooks/useIsMobile'
import { usePersistedLayout } from '../hooks/usePersistedLayout'
import { useReplayLayout } from '../hooks/useReplayLayout'
import type { PanelDef } from '../hooks/useReplayLayout'
import type { LayoutCategory, SessionDefault } from '../lib/defaultLayouts'
import { liveDefaultsFor, liveCategoryFor, sessionCategory } from '../lib/defaultLayouts'
import { trackStatusInfo } from '../lib/replay'
import type { SectorCell } from '../lib/replay'
import { defaultColumns } from '../lib/timingColumns'
import type { TimingColumnId, TimingColumnState } from '../lib/timingColumns'
import type {
  LiveRow,
  LiveSession,
  LiveState,
  LiveWeather,
  RaceControlMessage,
  ReplayData,
  SessionBestRecord,
  WeatherSample,
} from '../lib/api/types'

// Everything in the live snapshot is point-in-time, so the replay feeds (which
// reveal records as a clock advances) are fed a clock that is always "now".
const LIVE_NOW = Number.MAX_SAFE_INTEGER

const LiveRawStream = lazy(() => import('../components/live/LiveRawStream'))

const LIVE_PANEL_DEFS: PanelDef[] = [
  { id: 'trackmap', label: 'Track Map' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'timingTower', label: 'Timing Tower' },
  { id: 'raceControl', label: 'Race Control' },
  { id: 'sessionBests', label: 'Session Bests' },
  { id: 'pitStops', label: 'Pit Stops' },
  { id: 'speedTrap', label: 'Speed Trap' },
  { id: 'teamRadio', label: 'Team Radio' },
  { id: 'commentary', label: 'Commentary' },
  { id: 'championship', label: 'Championship' },
]

function parseNum(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function parseLapTime(value: string | null | undefined): number | null {
  if (!value) return null
  let seconds = 0
  for (const part of value.split(':')) seconds = seconds * 60 + parseFloat(part)
  return Number.isFinite(seconds) ? seconds : null
}

function utcMs(value: string | number | null | undefined): number | null {
  if (typeof value !== 'string') return null
  const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`
  const t = Date.parse(normalized)
  return Number.isFinite(t) ? t : null
}

function relSeconds(value: string | number | null | undefined, startMs: number): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  const t = utcMs(value)
  if (t === null || !Number.isFinite(startMs)) return null
  return (t - startMs) / 1000
}

const MOBILE_COLUMNS_KEY = 'f1replay.liveMobileColumns.v1'
const MOBILE_RACE_VISIBLE: TimingColumnId[] = ['pos', 'driver', 'interval', 'lastLap', 'tyre']
const MOBILE_LAP_VISIBLE: TimingColumnId[] = ['pos', 'driver', 'bestLap', 'lastLap', 'tyre']

function mobileDefaultColumns(mode: 'race' | 'lap'): TimingColumnState[] {
  const visible = new Set(mode === 'lap' ? MOBILE_LAP_VISIBLE : MOBILE_RACE_VISIBLE)
  return defaultColumns(mode).map((c) => ({ id: c.id, visible: visible.has(c.id) }))
}

function loadMobileColumns(): TimingColumnState[] | null {
  try {
    const raw = localStorage.getItem(MOBILE_COLUMNS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as TimingColumnState[]) : null
  } catch {
    return null
  }
}

const MOBILE_ORDER_KEY = 'f1replay.mobileOrder.v1'
const MOBILE_DEFAULT_ORDER = [
  'trackmap',
  'timingTower',
  'telemetry',
  'commentary',
  'raceControl',
  'sessionBests',
  'speedTrap',
  'pitStops',
  'teamRadio',
  'championship',
]

function loadMobileOrder(scopeKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${MOBILE_ORDER_KEY}.${scopeKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

function countdown(startUtc: string): string {
  const diff = new Date(startUtc).getTime() - Date.now()
  if (diff <= 0) return 'starting soon'
  const minutes = Math.floor(diff / 60000)
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)
  const mins = minutes % 60
  if (days > 0) return `in ${days}d ${hours}h`
  if (hours > 0) return `in ${hours}h ${mins}m`
  return `in ${mins}m`
}

function EmptyPanel({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
      <div className="flex flex-1 items-center justify-center text-center text-sm text-zinc-500">
        No current session
      </div>
    </div>
  )
}

function fmtStat(value: number | null, suffix: string, digits = 0): string {
  return value === null ? '-' : `${value.toFixed(digits)}${suffix}`
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="font-mono text-xs font-semibold text-white">{value}</span>
    </span>
  )
}

function MobileSessionHeader({
  session,
  running,
  next,
  weather,
}: {
  session: LiveSession | null
  running: boolean
  next: LiveState['next_session']
  weather: LiveWeather | null
}) {
  const status = session ? trackStatusInfo(session.track_status.code ?? null) : null
  const year = session?.started_at ? new Date(session.started_at).getFullYear() : null
  const nextLabel = next
    ? `${new Date(next.start_utc).getFullYear()} ${next.event_name} ${next.session_name} ${countdown(next.start_utc)}`
    : null

  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-3">
      {session ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {year !== null ? <span className="text-zinc-400">{year} </span> : null}
                {session.event_name}
              </p>
              <p className="text-xs text-zinc-400">
                {session.session_name}
                {!running ? ' (ENDED)' : ''}
              </p>
            </div>
            {status ? (
              <span
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold"
                style={{ color: status.color, backgroundColor: status.background }}
              >
                <img src={status.flag} alt="" className="h-4 w-4" />
                {status.label}
              </span>
            ) : null}
          </div>
          {weather ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {weather.rainfall ? (
                <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Rain
                </span>
              ) : null}
              <MobileStat label="Track" value={fmtStat(weather.track_temp, '°', 1)} />
              <MobileStat label="Air" value={fmtStat(weather.air_temp, '°', 1)} />
              <MobileStat label="Hum" value={fmtStat(weather.humidity, '%', 0)} />
              <MobileStat label="Wind" value={fmtStat(weather.wind_speed, ' m/s', 1)} />
            </div>
          ) : null}
          {!running && nextLabel ? <p className="mt-2 text-xs text-zinc-500">Next: {nextLabel}</p> : null}
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-white">No current session</p>
          {nextLabel ? <p className="mt-1 text-xs text-zinc-500">Next: {nextLabel}</p> : null}
        </>
      )}
    </div>
  )
}

function MobileEditControls({
  onUp,
  onDown,
  onHide,
  canUp,
  canDown,
}: {
  onUp: () => void
  onDown: () => void
  onHide: () => void
  canUp: boolean
  canDown: boolean
}) {
  return (
    <div className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/95 p-0.5 shadow-lg">
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        title="Move up"
      >
        <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor"><path d="M5 2l4 5H1z" /></svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        title="Move down"
      >
        <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor"><path d="M5 8L1 3h8z" /></svg>
      </button>
      <button
        type="button"
        onClick={onHide}
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-f1-red/20 hover:text-f1-red"
        title="Hide panel"
      >
        <svg viewBox="0 0 8 8" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth="1.5" fill="none">
          <path d="M1 1l6 6M7 1l-6 6" />
        </svg>
      </button>
    </div>
  )
}

// Mobile rendering of the live board: a single scrolling column instead of the
// draggable grid. It still registers with the layout context (active, panel
// defs, scope, layout accessors) so the burger menu works the same as desktop;
// editing here means hide/show and reorder rather than drag/resize.
function MobileLiveStack({
  scopeKey,
  category,
  sessionDefault,
  panelDefs,
  panels,
  header,
  heightFor,
  columns,
}: {
  scopeKey: string
  category: LayoutCategory
  sessionDefault: SessionDefault
  panelDefs: PanelDef[]
  panels: Record<string, ReactNode>
  header: ReactNode
  heightFor: (id: string) => { className?: string; style?: CSSProperties }
  columns: number
}) {
  const {
    setActive, setEditMode, registerReset, registerPanelDefs, applyScope,
    registerShowPanel, registerLayoutAccessors,
    editMode, hiddenPanels, hidePanel, handleShowPanel,
  } = useReplayLayout()

  const { layout, setLayout, reset } = usePersistedLayout(`${LAYOUT_STORAGE_KEY}.${scopeKey}`, sessionDefault.layout)
  const layoutRef = useRef(layout)
  useEffect(() => { layoutRef.current = layout }, [layout])

  // Keyed by scopeKey at the call site, so this remounts (and the initializer
  // re-reads the saved order) when the live session category changes.
  const [order, setOrderState] = useState<string[]>(() => loadMobileOrder(scopeKey) ?? MOBILE_DEFAULT_ORDER)
  const setOrder = useCallback((next: string[]) => {
    setOrderState(next)
    try {
      localStorage.setItem(`${MOBILE_ORDER_KEY}.${scopeKey}`, JSON.stringify(next))
    } catch {
      return
    }
  }, [scopeKey])

  useEffect(() => {
    applyScope(scopeKey, sessionDefault, category)
  }, [scopeKey, sessionDefault, category, applyScope])

  useEffect(() => {
    setActive(true)
    registerReset(() => { reset(); setOrder(MOBILE_DEFAULT_ORDER) })
    registerShowPanel(null)
    registerLayoutAccessors(() => layoutRef.current, (l) => setLayout(l))
    return () => {
      setActive(false)
      setEditMode(false)
      registerReset(null)
      registerShowPanel(null)
      registerLayoutAccessors(null, null)
    }
  }, [setActive, setEditMode, registerReset, registerShowPanel, registerLayoutAccessors, reset, setOrder, setLayout])

  useEffect(() => {
    registerPanelDefs(panelDefs)
    return () => registerPanelDefs([])
  }, [registerPanelDefs, panelDefs])

  // The mobile order is independent of the desktop grid; panels present in the
  // board but missing from a saved order (e.g. newly added) are appended.
  const present = panelDefs.map((p) => p.id).filter((id) => panels[id] !== undefined)
  const presentSet = new Set(present)
  const fullOrder = [
    ...order.filter((id) => presentSet.has(id)),
    ...present.filter((id) => !order.includes(id)),
  ]
  const visibleOrder = fullOrder.filter((id) => !hiddenPanels.has(id))
  const labelById = Object.fromEntries(panelDefs.map((p) => [p.id, p.label]))
  const hiddenDefs = panelDefs.filter((p) => hiddenPanels.has(p.id) && panels[p.id] !== undefined)

  function movePanel(id: string, dir: -1 | 1) {
    const vi = visibleOrder.indexOf(id)
    const target = vi + dir
    if (target < 0 || target >= visibleOrder.length) return
    const neighbor = visibleOrder[target]
    const next = [...fullOrder]
    const ia = next.indexOf(id)
    const ib = next.indexOf(neighbor)
    ;[next[ia], next[ib]] = [next[ib], next[ia]]
    setOrder(next)
  }

  // In landscape the board splits into columns. A CSS multi-column (masonry)
  // flow is used rather than a grid so panels of differing heights pack tightly
  // with no row gaps; a single column keeps the original centred flex stack.
  const multi = columns > 1
  return (
    <div className={multi ? 'w-full pb-8' : 'mx-auto w-full max-w-xl pb-8'}>
      <div className="mb-3">{header}</div>
      <div
        className={multi ? '' : 'flex flex-col gap-3'}
        style={multi ? { columnCount: columns, columnGap: 12 } : undefined}
      >
        {visibleOrder.map((id, idx) => {
          const { className, style } = heightFor(id)
          return (
            <div
              key={id}
              className={`relative ${multi ? 'mb-3 break-inside-avoid' : ''} ${className ?? ''}`}
              style={multi ? { ...style, breakInside: 'avoid' } : style}
            >
              {editMode ? (
                <MobileEditControls
                  onUp={() => movePanel(id, -1)}
                  onDown={() => movePanel(id, 1)}
                  onHide={() => hidePanel(id)}
                  canUp={idx > 0}
                  canDown={idx < visibleOrder.length - 1}
                />
              ) : null}
              {panels[id]}
            </div>
          )
        })}
      </div>
      {editMode && hiddenDefs.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Hidden panels</p>
          <div className="flex flex-wrap gap-2">
            {hiddenDefs.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleShowPanel(p.id)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-f1-red/50 hover:text-white"
              >
                <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 shrink-0" stroke="currentColor" strokeWidth="1.5" fill="none">
                  <path d="M4 1v6M1 4h6" />
                </svg>
                {labelById[p.id] ?? p.id}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function blankLive(data: LiveState): LiveState {
  return {
    ...data,
    available: false,
    live: false,
    session: null,
    weather: null,
    rows: [],
    race_control_messages: [],
    team_radio: [],
    pit_times: [],
    timing_stats: {},
    commentary: null,
    track: { x: [], y: [] },
  }
}

function liveWeatherToSample(weather: LiveWeather | null): WeatherSample | null {
  if (!weather) return null
  return {
    time: 0,
    air_temp: weather.air_temp,
    track_temp: weather.track_temp,
    humidity: weather.humidity,
    pressure: weather.pressure,
    wind_speed: weather.wind_speed,
    wind_direction: weather.wind_direction,
    rainfall: weather.rainfall,
  }
}

function toTowerRows(rows: LiveRow[], stats: LiveState['timing_stats']): TimingTowerRow[] {
  const pbMin = [Infinity, Infinity, Infinity]
  for (const r of rows) {
    const bs = stats?.[r.driver_number]?.best_sectors ?? []
    bs.forEach((val, i) => { const v = parseNum(val); if (v !== null && v < pbMin[i]) pbMin[i] = v })
  }

  return rows.map((row) => {
    const liveVals = [parseNum(row.sector_1), parseNum(row.sector_2), parseNum(row.sector_3)]
    const livePb = [row.sector_1_pb, row.sector_2_pb, row.sector_3_pb]
    const live_sectors: SectorCell[] = liveVals.map((v, i) => ({
      value: v,
      tone: v === null ? null : (pbMin[i] !== Infinity && v <= pbMin[i]) ? 'best' : livePb[i] ? 'pb' : 'set',
    }))
    const bestSectorVals = (stats?.[row.driver_number]?.best_sectors ?? []).map(parseNum)
    const personal_best_sectors: SectorCell[] = [0, 1, 2].map((i) => {
      const v = bestSectorVals[i] ?? null
      return { value: v, tone: v === null ? null : v === pbMin[i] ? 'best' : 'pb' }
    })

    return {
      number: row.driver_number,
      abbreviation: row.abbreviation,
      team_colour: row.team_colour,
      position: row.position,
      compound: row.compound,
      tyre_age: row.tyre_age,
      pitted: row.in_pit,
      retired: row.retired && row.status !== 'DNS',
      dns: row.status === 'DNS',
      interval: row.interval,
      gap_leader: row.gap,
      best_lap: parseLapTime(stats?.[row.driver_number]?.best_lap ?? row.best_lap),
      best_lap_compound: null,
      best_lap_tyre_age: null,
      last_lap: parseLapTime(row.last_lap),
      live_sectors,
      best_sectors: [],
      personal_best_sectors,
    }
  })
}

// Adapt the live snapshot into the ReplayData shape so the replay feeds can be
// reused directly. hasMap reports whether there is geometry to draw a track.
function buildLiveReplay(data: LiveState): { replay: ReplayData; hasMap: boolean } {
  const startMs = data.session?.started_at ? Date.parse(data.session.started_at) : NaN

  // Show the time each message came through relative to the session start. This is
  // stable (a fixed point in the session) rather than a clock that ticks upward.
  const raceControl: RaceControlMessage[] = (data.race_control_messages ?? []).map((m) => ({
    ...m,
    time: relSeconds(m.time as unknown as string | number | null, startMs),
  }))

  const teamRadio = (data.team_radio ?? []).map((c) => ({
    utc: c.utc ?? null,
    driver_number: c.driver_number,
    url: c.url,
    time: relSeconds(c.utc ?? null, startMs),
    driver_code: null,
    racing_number: c.driver_number ?? null,
  }))

  const sessionBests: SessionBestRecord[] = []
  for (const [num, stat] of Object.entries(data.timing_stats ?? {})) {
    const lap = parseLapTime(stat.best_lap)
    if (lap !== null) {
      sessionBests.push({ time: 0, driver: num, kind: 'lap', value: lap, sectors: stat.best_sectors.map(parseNum) })
    }
    ;(['s1', 's2', 's3'] as const).forEach((kind, i) => {
      const v = parseNum(stat.best_sectors[i])
      if (v !== null) sessionBests.push({ time: 0, driver: num, kind, value: v })
    })
    const st = parseNum(stat.best_speeds?.st ?? null)
    if (st !== null) sessionBests.push({ time: 0, driver: num, kind: 'st', value: st })
  }

  const positions = data.rows.filter((r) => r.x !== null && r.y !== null)
  const allX = positions.map((r) => r.x as number).concat(data.track?.x ?? [])
  const allY = positions.map((r) => r.y as number).concat(data.track?.y ?? [])
  const hasMap = allX.length > 0 && allY.length > 0

  let bounds = { min_x: 0, max_x: 1, min_y: 0, max_y: 1 }
  if (hasMap) {
    const min_x = Math.min(...allX)
    const max_x = Math.max(...allX)
    const min_y = Math.min(...allY)
    const max_y = Math.max(...allY)
    const mx = (max_x - min_x) * 0.15 || 100
    const my = (max_y - min_y) * 0.15 || 100
    bounds = { min_x: min_x - mx, max_x: max_x + mx, min_y: min_y - my, max_y: max_y + my }
  }

  const tsCode = data.session?.track_status.code ?? null

  const replay: ReplayData = {
    available: true,
    has_position: positions.length > 0,
    step: 1,
    duration: 0,
    race_start: null,
    track_status: tsCode ? [{ start: 0, code: tsCode, message: data.session?.track_status.message || null }] : [],
    total_laps: data.session?.total_laps ?? null,
    time: [0],
    track: data.track,
    corners: [],
    bounds,
    drivers: data.rows.map((r) => ({
      number: r.driver_number,
      abbreviation: r.abbreviation,
      full_name: r.full_name,
      team_name: r.team_name,
      team_colour: r.team_colour,
      headshot_url: r.headshot_url ?? null,
    })),
    positions: Object.fromEntries(
      data.rows.map((r) => [r.driver_number, { x: r.x !== null ? [r.x] : [], y: r.y !== null ? [r.y] : [] }]),
    ),
    laps: {},
    race_control_messages: raceControl,
    team_radio: teamRadio,
    session_bests: sessionBests,
    weather: [],
    qualifying_segments: [],
    session_window: null,
  }

  return { replay, hasMap }
}

function LiveBoard({ data }: { data: LiveState }) {
  const [selected, setSelected] = useState<string | null>(null)
  // Clicking the already-selected driver deselects them.
  const toggleSelected = useCallback((id: string | null) => {
    setSelected((prev) => (prev === id ? null : id))
  }, [])
  const { editMode, setTitleInfo, setStatusInfo, setSessionNav, timingColumns, setTimingColumns } = useReplayLayout()
  const isMobile = useIsMobile()
  const mobileColumnCount = useMobileColumns()

  const [mobileColumns, setMobileColumnsState] = useState<TimingColumnState[] | null>(loadMobileColumns)
  const setMobileColumns = useCallback((next: TimingColumnState[]) => {
    setMobileColumnsState(next)
    try {
      localStorage.setItem(MOBILE_COLUMNS_KEY, JSON.stringify(next))
    } catch {
      return
    }
  }, [])

  const isLive = data.source === 'live'
  const running = isLive && data.live
  const view = useMemo(() => (isLive ? data : blankLive(data)), [isLive, data])

  const session = view.session
  const sessionType = session?.session_type ?? 'FP1'
  const lapMode = sessionType !== 'R' && sessionType !== 'Sprint'
  const scopeKey = `live-${sessionCategory(sessionType)}`
  const category = liveCategoryFor(sessionType)
  const sessionDefault = useMemo(() => liveDefaultsFor(sessionType), [sessionType])

  const board = useMemo(() => toTowerRows(view.rows, view.timing_stats), [view.rows, view.timing_stats])
  const { replay, hasMap } = useMemo(() => buildLiveReplay(view), [view])
  const pitDrivers = useMemo(
    () => new Set(view.rows.filter((r) => r.in_pit).map((r) => r.driver_number)),
    [view.rows],
  )
  const weatherSample = useMemo(() => liveWeatherToSample(view.weather), [view.weather])

  // Car positions (Position.z) and telemetry (CarData.z) are the only live
  // topics F1 gates behind an F1TV login. When signed out and that data is
  // absent, overlay those panels with a sign-in prompt; everything else streams
  // freely. Once signed in, the feed reconnects with auth and the overlays drop.
  const authenticated = data.authenticated ?? false
  const hasCarPositions = useMemo(
    () => view.rows.some((r) => r.x !== null && r.y !== null),
    [view.rows],
  )
  const hasCarData = useMemo(
    () => view.rows.some((r) => r.speed !== null || r.gear !== null || r.rpm !== null),
    [view.rows],
  )
  const hasChampionship = useMemo(
    () => !!view.championship && (view.championship.drivers.length > 0 || view.championship.teams.length > 0),
    [view.championship],
  )
  const trackMapLocked = isLive && !authenticated && !hasCarPositions
  const telemetryLocked = isLive && !authenticated && !hasCarData
  // The projected standings are derived from the auth-gated timing feed. They
  // only exist for race sessions, so for practice/qualifying the panel keeps its
  // normal "race sessions only" message rather than a sign-in overlay.
  const championshipLocked = isLive && !authenticated && !lapMode && !hasChampionship

  const next = data.next_session
  useEffect(() => {
    if (isLive && session) {
      const endedTag = !running ? ' (ENDED)' : ''
      const upNext = !running && next
        ? ` · Next: ${new Date(next.start_utc).getFullYear()} ${next.event_name} ${next.session_name} ${countdown(next.start_utc)}`
        : ''
      setTitleInfo({
        year: session.started_at ? new Date(session.started_at).getFullYear() : null,
        eventName: session.event_name,
        sessionName: `${session.session_name ?? ''}${endedTag}${upNext}`,
      })
    } else {
      setTitleInfo({
        year: null,
        eventName: 'No current session',
        sessionName: next
          ? `Next: ${new Date(next.start_utc).getFullYear()} ${next.event_name} ${next.session_name} ${countdown(next.start_utc)}`
          : null,
      })
    }
    setSessionNav(null)
    return () => {
      setTitleInfo(null)
      setSessionNav(null)
    }
  }, [isLive, running, session, next, setTitleInfo, setSessionNav])

  useEffect(() => {
    if (isLive) {
      setStatusInfo({ status: trackStatusInfo(session?.track_status.code ?? null), weather: weatherSample })
    } else {
      setStatusInfo(null)
    }
    return () => setStatusInfo(null)
  }, [isLive, session, weatherSample, setStatusInfo])

  const sessionStartMs = session?.started_at ? Date.parse(session.started_at) : null
  const lastDataMs = session?.data_utc
    ? Date.parse(session.data_utc)
    : view.updated_at
      ? Date.parse(view.updated_at)
      : null
  const elapsed =
    sessionStartMs !== null && lastDataMs !== null
      ? (lastDataMs - sessionStartMs) / 1000
      : null
  const liveHeader = isLive ? (
    <ReplayClock
      relative={parseLapTime(session?.time_remaining)}
      lap={session?.current_lap ?? 0}
      totalLaps={session?.total_laps ?? null}
      label={session && !session.total_laps ? session.session_name : null}
      hideHours={sessionType === 'Q' || sessionType === 'SQ'}
      elapsed={elapsed}
      lapsPrimary={!lapMode}
    />
  ) : undefined

  const selectedRow = selected ? view.rows.find((r) => r.driver_number === selected) ?? null : null

  const panels: Record<string, ReactNode> = {
    trackmap: !isLive ? (
      <EmptyPanel title="Track Map" />
    ) : (
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-zinc-800 bg-surface">
        <div className="absolute inset-0 overflow-hidden p-3">
          {hasMap ? (
            <TrackMap replay={replay} currentTime={0} selected={selected} onSelect={toggleSelected} live editMode={editMode} pitDrivers={pitDrivers} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
              <p className="mt-4 text-sm text-zinc-400">Waiting for car positions...</p>
            </div>
          )}
        </div>
        {trackMapLocked && <LiveAuthOverlay label="The live track map" />}
      </div>
    ),
    telemetry: (
      <div className="relative h-full w-full">
        <LiveTelemetry row={selectedRow} />
        {telemetryLocked && <LiveAuthOverlay label="Live telemetry" />}
      </div>
    ),
    timingTower: (
      <TimingTower
        rows={board}
        selected={selected}
        onSelect={toggleSelected}
        mode={lapMode ? 'lap' : 'race'}
        columns={isMobile ? mobileColumns ?? mobileDefaultColumns(lapMode ? 'lap' : 'race') : timingColumns}
        onColumnsChange={isMobile ? setMobileColumns : setTimingColumns}
        header={liveHeader}
      />
    ),
    raceControl: isLive ? <RaceControlFeed messages={replay.race_control_messages} currentTime={LIVE_NOW} /> : <EmptyPanel title="Race Control" />,
    sessionBests: <SessionBestsFeed replay={replay} currentTime={LIVE_NOW} />,
    pitStops: isLive ? <LivePitStops times={view.pit_times ?? []} drivers={view.rows} /> : <EmptyPanel title="Pit Stops" />,
    speedTrap: isLive ? <SpeedTrapFeed replay={replay} currentTime={LIVE_NOW} /> : <EmptyPanel title="Speed Trap" />,
    teamRadio: isLive ? <TeamRadioFeed replay={replay} currentTime={LIVE_NOW} live /> : <EmptyPanel title="Team Radio" />,
    commentary: isLive ? <CommentaryAudio commentary={view.commentary ?? null} currentTime={0} playing speed={1} live /> : <EmptyPanel title="Commentary" />,
    championship: isLive ? (
      <div className="relative h-full w-full">
        <ChampionshipPrediction data={view.championship ?? null} />
        {championshipLocked && <LiveAuthOverlay label="The projected standings" />}
      </div>
    ) : <EmptyPanel title="Standings" />,
  }

  if (isMobile) {
    const towerHeight = Math.max(board.length * 30 + 100, 220)
    const heightFor = (id: string): { className?: string; style?: CSSProperties } => {
      switch (id) {
        case 'trackmap': return { className: 'aspect-[4/3] w-full' }
        case 'timingTower': return { style: { height: towerHeight } }
        case 'telemetry': return { className: 'h-56' }
        case 'commentary': return { className: 'h-24' }
        case 'raceControl': return { className: 'h-72' }
        case 'teamRadio': return { className: 'h-72' }
        case 'championship': return { className: 'h-96' }
        default: return { className: 'h-64' }
      }
    }
    return (
      <MobileLiveStack
        key={scopeKey}
        scopeKey={scopeKey}
        category={category}
        sessionDefault={sessionDefault}
        panelDefs={LIVE_PANEL_DEFS}
        panels={panels}
        header={<MobileSessionHeader session={session} running={running} next={next} weather={view.weather} />}
        heightFor={heightFor}
        columns={mobileColumnCount}
      />
    )
  }

  return (
    <PanelGrid
      scopeKey={scopeKey}
      category={category}
      sessionDefault={sessionDefault}
      panelDefs={LIVE_PANEL_DEFS}
      panels={panels}
    />
  )
}

export default function Live() {
  const { data, error, loading } = useLive()

  let content: ReactNode
  if (loading && !data) {
    content = (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
      </div>
    )
  } else if (error && !data) {
    content = (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-white">Could not load live timing</h1>
        <p className="mt-3 max-w-md text-zinc-400">Is the data server running?</p>
      </div>
    )
  } else if (!data) {
    content = null
  } else {
    content = <LiveBoard data={data} />
  }

  return (
    <>
      {content}
      <Suspense fallback={null}>
        <LiveRawStream />
      </Suspense>
    </>
  )
}
