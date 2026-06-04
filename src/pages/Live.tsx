import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import PanelGrid from '../components/replay/PanelGrid'
import ReplayClock from '../components/replay/ReplayClock'
import TimingTower from '../components/replay/TimingTower'
import type { TimingTowerRow } from '../components/replay/TimingTower'
import TrackMap from '../components/replay/TrackMap'
import LiveRaceControl from '../components/live/LiveRaceControl'
import LiveTeamRadio from '../components/live/LiveTeamRadio'
import LivePitStops from '../components/live/LivePitStops'
import LiveSpeedTrap from '../components/live/LiveSpeedTrap'
import LiveTelemetry from '../components/live/LiveTelemetry'
import { useLive } from '../hooks/useApi'
import { useReplayLayout } from '../hooks/useReplayLayout'
import type { PanelDef } from '../hooks/useReplayLayout'
import { LIVE, liveCategoryFor, sessionCategory } from '../lib/defaultLayouts'
import { trackStatusInfo } from '../lib/replay'
import type { SectorCell } from '../lib/replay'
import type { LiveRow, LiveState, LiveWeather, ReplayData, WeatherSample } from '../lib/api/types'

const LIVE_PANEL_DEFS: PanelDef[] = [
  { id: 'trackmap', label: 'Track Map' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'timingTower', label: 'Timing Tower' },
  { id: 'raceControl', label: 'Race Control' },
  { id: 'pitStops', label: 'Pit Stops' },
  { id: 'speedTrap', label: 'Speed Trap' },
  { id: 'teamRadio', label: 'Team Radio' },
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

function countdown(startUtc: string): string {
  const diff = new Date(startUtc).getTime() - Date.now()
  if (diff <= 0) {
    return 'starting soon'
  }
  const minutes = Math.floor(diff / 60000)
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)
  const mins = minutes % 60
  if (days > 0) {
    return `in ${days}d ${hours}h`
  }
  if (hours > 0) {
    return `in ${hours}h ${mins}m`
  }
  return `in ${mins}m`
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
      {children}
    </span>
  )
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
  // Fastest current sector and fastest personal-best sector across the field,
  // so the leading cell in each can be highlighted purple.
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

function liveToReplayData(data: LiveState): ReplayData | null {
  if (!data.rows.length) return null

  const positions = data.rows.filter((r) => r.x !== null && r.y !== null)
  if (!positions.length) return null

  const carX = positions.map((r) => r.x as number)
  const carY = positions.map((r) => r.y as number)
  const allX = carX.concat(data.track?.x || [])
  const allY = carY.concat(data.track?.y || [])

  if (!allX.length || !allY.length) return null

  const min_x = Math.min(...allX)
  const max_x = Math.max(...allX)
  const min_y = Math.min(...allY)
  const max_y = Math.max(...allY)

  const margin_x = (max_x - min_x) * 0.15 || 100
  const margin_y = (max_y - min_y) * 0.15 || 100

  const tsCode = data.session?.track_status.code ?? null

  return {
    available: true,
    step: 1,
    duration: 0,
    race_start: null,
    track_status: tsCode ? [{ start: 0, code: tsCode, message: data.session?.track_status.message || null }] : [],
    total_laps: data.session?.total_laps ?? null,
    time: [0],
    track: data.track,
    corners: [],
    bounds: {
      min_x: min_x - margin_x,
      max_x: max_x + margin_x,
      min_y: min_y - margin_y,
      max_y: max_y + margin_y,
    },
    drivers: data.rows.map((r) => ({
      number: r.driver_number,
      abbreviation: r.abbreviation,
      full_name: r.full_name,
      team_name: r.team_name,
      team_colour: r.team_colour,
      headshot_url: null,
    })),
    positions: Object.fromEntries(
      data.rows.map((r) => [
        r.driver_number,
        {
          x: r.x !== null ? [r.x] : [],
          y: r.y !== null ? [r.y] : [],
        },
      ]),
    ),
    laps: {},
    race_control_messages: data.race_control_messages,
    team_radio: [],
    session_bests: [],
    weather: [],
    qualifying_segments: [],
    session_window: null,
  }
}

function EmptyState({ state }: { state: LiveState }) {
  const next = state.next_session
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Pill>
        <span className="h-1.5 w-1.5 rounded-full bg-f1-red" />
        Live
      </Pill>
      <h1 className="mt-5 text-3xl font-bold text-white">No live session right now</h1>
      <p className="mt-3 max-w-md text-zinc-400">
        When a session is running, live timing, tyre strategy and the timing tower will appear here
        in real time.
      </p>
      {next ? (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-surface px-6 py-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Next session</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {next.event_name} · {next.session_name}
          </p>
          <p className="mt-1 text-sm text-f1-red">{countdown(next.start_utc)}</p>
        </div>
      ) : null}
    </div>
  )
}

function LiveBoard({ data }: { data: LiveState }) {
  const [selected, setSelected] = useState<string | null>(null)
  const { setTitleInfo, setStatusInfo, setSessionNav, timingColumns, setTimingColumns } = useReplayLayout()

  const session = data.session
  const sessionType = session?.session_type ?? 'FP1'
  const lapMode = sessionType !== 'R' && sessionType !== 'Sprint'
  const scopeKey = `live-${sessionCategory(sessionType)}`
  const category = liveCategoryFor(sessionType)

  const board = useMemo(() => toTowerRows(data.rows, data.timing_stats), [data.rows, data.timing_stats])
  const replayData = useMemo(() => liveToReplayData(data), [data])
  const weatherSample = useMemo(() => liveWeatherToSample(data.weather), [data.weather])

  useEffect(() => {
    if (!session) return
    setTitleInfo({ eventName: session.event_name, sessionName: session.session_name, location: session.location })
    setSessionNav(null)
    return () => {
      setTitleInfo(null)
      setSessionNav(null)
    }
  }, [session, setTitleInfo, setSessionNav])

  const flag = session?.track_status.code ?? null
  useEffect(() => {
    setStatusInfo({ status: trackStatusInfo(flag), weather: weatherSample })
    return () => setStatusInfo(null)
  }, [flag, weatherSample, setStatusInfo])

  const liveHeader = (
    <ReplayClock
      relative={parseLapTime(session?.time_remaining)}
      lap={session?.current_lap ?? 0}
      totalLaps={session?.total_laps ?? null}
      label={session && !session.total_laps ? session.session_name : null}
      hideHours={sessionType === 'Q' || sessionType === 'SQ'}
    />
  )

  const panels: Record<string, ReactNode> = {
    trackmap: (
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-zinc-800 bg-surface">
        <div className="absolute inset-0 overflow-hidden p-3">
          {replayData ? (
            <TrackMap replay={replayData} currentTime={0} selected={selected} onSelect={setSelected} />
          ) : data.live ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
              <p className="mt-4 text-sm text-zinc-400">Waiting for car positions...</p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-medium text-zinc-400">No live session</p>
              <p className="mt-1 text-xs leading-snug text-zinc-600">
                The track map appears here once a session is running and cars are on track.
              </p>
            </div>
          )}
        </div>
      </div>
    ),
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
    telemetry: <LiveTelemetry row={selected ? data.rows.find((r) => r.driver_number === selected) ?? null : null} />,
    raceControl: <LiveRaceControl messages={data.race_control_messages} />,
    pitStops: <LivePitStops times={data.pit_times ?? []} drivers={data.rows} />,
    speedTrap: <LiveSpeedTrap rows={data.rows} />,
    teamRadio: <LiveTeamRadio clips={data.team_radio} drivers={data.rows} />,
  }

  return (
    <PanelGrid
      scopeKey={scopeKey}
      category={category}
      sessionDefault={LIVE}
      panelDefs={LIVE_PANEL_DEFS}
      panels={panels}
    />
  )
}

export default function Live() {
  const { data, error, loading } = useLive()

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-white">Could not load live timing</h1>
        <p className="mt-3 max-w-md text-zinc-400">Is the data server running?</p>
      </div>
    )
  }

  if (!data) {
    return null
  }

  if (data.source === 'none' || (data.rows.length === 0 && !data.live)) {
    return <EmptyState state={data} />
  }

  return <LiveBoard data={data} />
}
