import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import CommentaryAudio from '../components/replay/CommentaryAudio'
import PanelGrid from '../components/replay/PanelGrid'
import RaceControlFeed from '../components/replay/RaceControlFeed'
import ReplayClock from '../components/replay/ReplayClock'
import SessionBestsFeed from '../components/replay/SessionBestsFeed'
import SpeedTrapFeed from '../components/replay/SpeedTrapFeed'
import TeamRadioFeed from '../components/replay/TeamRadioFeed'
import TimingTower from '../components/replay/TimingTower'
import type { TimingTowerRow } from '../components/replay/TimingTower'
import TrackMap from '../components/replay/TrackMap'
import LivePitStops from '../components/live/LivePitStops'
import LiveTelemetry from '../components/live/LiveTelemetry'
import { useLive } from '../hooks/useApi'
import { useReplayLayout } from '../hooks/useReplayLayout'
import type { PanelDef } from '../hooks/useReplayLayout'
import { liveDefaultsFor, liveCategoryFor, sessionCategory } from '../lib/defaultLayouts'
import { trackStatusInfo } from '../lib/replay'
import type { SectorCell } from '../lib/replay'
import type {
  LiveRow,
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

const LiveRawStream = __DEBUG_TOOLS__
  ? lazy(() => import('../components/live/LiveRawStream'))
  : null

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

function relSeconds(value: string | number | null | undefined, startMs: number): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  const t = Date.parse(value)
  if (!Number.isFinite(t) || !Number.isFinite(startMs)) return null
  return (t - startMs) / 1000
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
  const liveMin = [Infinity, Infinity, Infinity]
  const pbMin = [Infinity, Infinity, Infinity]
  for (const r of rows) {
    const live = [parseNum(r.sector_1), parseNum(r.sector_2), parseNum(r.sector_3)]
    live.forEach((v, i) => { if (v !== null && v < liveMin[i]) liveMin[i] = v })
    const bs = stats?.[r.driver_number]?.best_sectors ?? []
    bs.forEach((val, i) => { const v = parseNum(val); if (v !== null && v < pbMin[i]) pbMin[i] = v })
  }

  return rows.map((row) => {
    const liveVals = [parseNum(row.sector_1), parseNum(row.sector_2), parseNum(row.sector_3)]
    const livePb = [row.sector_1_pb, row.sector_2_pb, row.sector_3_pb]
    const live_sectors: SectorCell[] = liveVals.map((v, i) => ({
      value: v,
      tone: v === null ? null : v === liveMin[i] ? 'best' : livePb[i] ? 'pb' : 'set',
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
      headshot_url: null,
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
  const { setTitleInfo, setStatusInfo, setSessionNav, timingColumns, setTimingColumns } = useReplayLayout()

  const isLive = data.live
  const view = useMemo(() => (isLive ? data : blankLive(data)), [isLive, data])

  const session = view.session
  const sessionType = session?.session_type ?? 'FP1'
  const lapMode = sessionType !== 'R' && sessionType !== 'Sprint'
  const scopeKey = `live-${sessionCategory(sessionType)}`
  const category = liveCategoryFor(sessionType)
  const sessionDefault = useMemo(() => liveDefaultsFor(sessionType), [sessionType])

  const board = useMemo(() => toTowerRows(view.rows, view.timing_stats), [view.rows, view.timing_stats])
  const { replay, hasMap } = useMemo(() => buildLiveReplay(view), [view])
  const weatherSample = useMemo(() => liveWeatherToSample(view.weather), [view.weather])

  const next = data.next_session
  useEffect(() => {
    if (isLive && session) {
      setTitleInfo({
        year: session.started_at ? new Date(session.started_at).getFullYear() : null,
        eventName: session.event_name,
        sessionName: session.session_name,
        location: session.location,
      })
    } else {
      setTitleInfo({
        year: null,
        eventName: 'No current session',
        sessionName: next ? `Next: ${next.event_name} · ${next.session_name}` : null,
        location: next ? countdown(next.start_utc) : null,
      })
    }
    setSessionNav(null)
    return () => {
      setTitleInfo(null)
      setSessionNav(null)
    }
  }, [isLive, session, next, setTitleInfo, setSessionNav])

  useEffect(() => {
    if (isLive) {
      setStatusInfo({ status: trackStatusInfo(session?.track_status.code ?? null), weather: weatherSample })
    } else {
      setStatusInfo(null)
    }
    return () => setStatusInfo(null)
  }, [isLive, session, weatherSample, setStatusInfo])

  const liveHeader = isLive ? (
    <ReplayClock
      relative={parseLapTime(session?.time_remaining)}
      lap={session?.current_lap ?? 0}
      totalLaps={session?.total_laps ?? null}
      label={session && !session.total_laps ? session.session_name : null}
      hideHours={sessionType === 'Q' || sessionType === 'SQ'}
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
            <TrackMap replay={replay} currentTime={0} selected={selected} onSelect={setSelected} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
              <p className="mt-4 text-sm text-zinc-400">Waiting for car positions...</p>
            </div>
          )}
        </div>
      </div>
    ),
    telemetry: <LiveTelemetry row={selectedRow} />,
    timingTower: (
      <TimingTower
        rows={board}
        selected={selected}
        onSelect={setSelected}
        mode={lapMode ? 'lap' : 'race'}
        columns={timingColumns}
        onColumnsChange={setTimingColumns}
        header={liveHeader}
      />
    ),
    raceControl: isLive ? <RaceControlFeed messages={replay.race_control_messages} currentTime={LIVE_NOW} /> : <EmptyPanel title="Race Control" />,
    sessionBests: <SessionBestsFeed replay={replay} currentTime={LIVE_NOW} />,
    pitStops: isLive ? <LivePitStops times={view.pit_times ?? []} drivers={view.rows} /> : <EmptyPanel title="Pit Stops" />,
    speedTrap: isLive ? <SpeedTrapFeed replay={replay} currentTime={LIVE_NOW} /> : <EmptyPanel title="Speed Trap" />,
    teamRadio: isLive ? <TeamRadioFeed replay={replay} currentTime={LIVE_NOW} /> : <EmptyPanel title="Team Radio" />,
    commentary: isLive ? <CommentaryAudio commentary={view.commentary ?? null} currentTime={0} playing speed={1} live /> : <EmptyPanel title="Commentary" />,
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
      {LiveRawStream && (
        <Suspense fallback={null}>
          <LiveRawStream />
        </Suspense>
      )}
    </>
  )
}
