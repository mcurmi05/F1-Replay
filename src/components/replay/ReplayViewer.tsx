import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import StatusCard from '../StatusCard'
import CommentaryAudio from './CommentaryAudio'
import PanelGrid from './PanelGrid'
import PitStopFeed from './PitStopFeed'
import PlaybackControls from './PlaybackControls'
import RaceControlFeed from './RaceControlFeed'
import ReplayClock from './ReplayClock'
import SessionBestsFeed from './SessionBestsFeed'
import SpeedTrapFeed from './SpeedTrapFeed'
import TeamRadioFeed from './TeamRadioFeed'
import TelemetryPanel from './TelemetryPanel'
import TimingTower from './TimingTower'
import TrackMap from './TrackMap'
import { useReplay, useSchedule } from '../../hooks/useApi'
import { usePlayback } from '../../hooks/usePlayback'
import { useReplayLayout } from '../../hooks/useReplayLayout'
import type { PanelDef } from '../../hooks/useReplayLayout'
import { defaultsFor, sessionCategory } from '../../lib/defaultLayouts'
import {
  currentLapNumber,
  currentRaceControlFlag,
  currentTrackStatus,
  currentWeather,
  mergeFlagCodes,
  lapLeaderboard,
  leaderboard,
  qualifyingStatus,
  trackStatusInfo,
} from '../../lib/replay'
import type { SessionSummary } from '../../lib/api/types'

const PANEL_DEFS: PanelDef[] = [
  { id: 'trackmap',    label: 'Track Map' },
  { id: 'raceControl', label: 'Race Control' },
  { id: 'pitStops',    label: 'Pit Stops' },
  { id: 'telemetry',   label: 'Telemetry' },
  { id: 'timingTower', label: 'Timing Tower' },
  { id: 'teamRadio',   label: 'Team Radio' },
  { id: 'sessionBests', label: 'Session Bests' },
  { id: 'speedTrap',   label: 'Speed Trap' },
  { id: 'commentary',  label: 'Commentary' },
  { id: 'playback',    label: 'Playback' },
]

export default function ReplayViewer({
  year,
  event,
  session,
  summary,
}: {
  year: number
  event: string
  session: string
  summary: SessionSummary
}) {
  const { data, error, loading } = useReplay(year, event, session)
  const playback = usePlayback(data?.duration ?? 0)
  const [selected, setSelected] = useState<string | null>(null)
  // Clicking the already-selected driver deselects them.
  const toggleSelected = useCallback((id: string | null) => {
    setSelected((prev) => (prev === id ? null : id))
  }, [])
  const sessionDefault = useMemo(() => defaultsFor(session), [session])
  const { editMode, setTitleInfo, setStatusInfo, setSessionNav, timingColumns, setTimingColumns } = useReplayLayout()
  const { data: schedule } = useSchedule(year)

  useEffect(() => {
    setTitleInfo({ year, eventName: summary.event_name, sessionName: summary.session_name, location: summary.location })
    return () => setTitleInfo(null)
  }, [year, summary.event_name, summary.session_name, summary.location, setTitleInfo])

  useEffect(() => {
    if (!schedule) return
    const SESSION_ORDER = ['FP1', 'FP2', 'FP3', 'SQ', 'Sprint', 'Q', 'R']
    const ev = schedule.find((e) => String(e.round) === String(event) || (e.event_name === summary.event_name && e.location === summary.location))
    if (!ev) { setSessionNav(null); return }
    const available = ev.sessions
      .map((s) => {
        if (s.name === 'Practice 1') return 'FP1'
        if (s.name === 'Practice 2') return 'FP2'
        if (s.name === 'Practice 3') return 'FP3'
        if (s.name === 'Sprint Qualifying' || s.name === 'Sprint Shootout') return 'SQ'
        if (s.name === 'Sprint') return 'Sprint'
        if (s.name === 'Qualifying') return 'Q'
        if (s.name === 'Race') return 'R'
        return null
      })
      .filter(Boolean) as string[]
    const ordered = SESSION_ORDER.filter((s) => available.includes(s))
    const idx = ordered.indexOf(session)
    const prev = idx > 0 ? `/replay/${year}/${event}/${ordered[idx - 1]}` : null
    const next = idx >= 0 && idx < ordered.length - 1 ? `/replay/${year}/${event}/${ordered[idx + 1]}` : null
    setSessionNav({ prev, next })
    return () => setSessionNav(null)
  }, [schedule, year, event, session, summary.event_name, summary.location, setSessionNav])

  const time = playback.currentTime
  const effectiveFlag = data ? mergeFlagCodes(
    currentTrackStatus(data.track_status, time)?.code ?? null,
    currentRaceControlFlag(data.race_control_messages, time),
  ) : null
  const weather = data ? currentWeather(data.weather, time) : null

  useEffect(() => {
    if (!data) return
    setStatusInfo({ status: trackStatusInfo(effectiveFlag), weather })
    return () => setStatusInfo(null)
  }, [data, effectiveFlag, weather, setStatusInfo])

  if (loading || error || !data || !data.available) {
    return (
      <div className="space-y-4">
        {loading ? <StatusCard text="Loading replay data..." /> : null}
        {error ? <StatusCard text={`Could not load replay: ${error.message}`} /> : null}
        {!loading && !error && (!data || !data.available) ? (
          <StatusCard text="This session has no replay data available." />
        ) : null}
      </div>
    )
  }

  const relative = data.race_start === null ? null : time - data.race_start
  const lap = currentLapNumber(data, time)
  const lapMode = session !== 'R' && session !== 'Sprint'
  const isQualifying = lapMode && data.qualifying_segments.length > 0
  const qStatus = qualifyingStatus(data.qualifying_segments, time)
  const segmentLabel = isQualifying ? qStatus.label : null
  const sessionWindow = data.session_window
  let clockRelative: number | null
  const markers: { time: number; label: string }[] = []
  if (isQualifying) {
    clockRelative = qStatus.running && qStatus.segment ? time - qStatus.segment.start : null
    for (const seg of data.qualifying_segments) {
      markers.push({ time: seg.start, label: seg.name })
      markers.push({ time: seg.end, label: 'End' })
    }
  } else if (lapMode) {
    clockRelative =
      sessionWindow && time >= sessionWindow.start && time <= sessionWindow.end
        ? time - sessionWindow.start
        : null
    if (sessionWindow) {
      markers.push({ time: sessionWindow.start, label: 'Start' })
      markers.push({ time: sessionWindow.end, label: 'End' })
    }
  } else {
    clockRelative = relative
    if (sessionWindow) {
      markers.push({ time: sessionWindow.start, label: 'Start' })
      markers.push({ time: sessionWindow.end, label: 'End' })
    }
  }
  const board = lapMode ? lapLeaderboard(data, time, qStatus.segment) : leaderboard(data, time)
  const pitLabel = session === 'R' || session === 'Sprint' ? 'Race' : isQualifying ? 'Qualifying' : 'Practice'

  const panels: Record<string, ReactNode> = {
    trackmap: (
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-zinc-800 bg-surface">
        <div className="absolute inset-0 overflow-hidden p-3">
          <TrackMap replay={data} currentTime={time} selected={selected} onSelect={toggleSelected} editMode={editMode} />
        </div>
      </div>
    ),
    raceControl: <RaceControlFeed messages={data.race_control_messages} currentTime={time} origin={data.race_start ?? data.session_window?.start ?? 0} />,
    pitStops: <PitStopFeed replay={data} currentTime={time} label={pitLabel} />,
    telemetry: selected ? (
      <TelemetryPanel year={year} event={event} session={session} replay={data} driver={selected} currentTime={time} />
    ) : (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-surface p-5 text-center text-sm text-zinc-500">
        Select a driver to view telemetry
      </div>
    ),
    timingTower: (
      <TimingTower
        rows={board}
        selected={selected}
        onSelect={toggleSelected}
        mode={lapMode ? 'lap' : 'race'}
        columns={timingColumns}
        onColumnsChange={setTimingColumns}
        header={<ReplayClock relative={clockRelative} lap={lap} totalLaps={data.total_laps} label={segmentLabel} hideHours={isQualifying} />}
      />
    ),
    teamRadio: <TeamRadioFeed replay={data} currentTime={time} />,
    sessionBests: <SessionBestsFeed replay={data} currentTime={time} />,
    speedTrap: <SpeedTrapFeed replay={data} currentTime={time} />,
    commentary: (
      <CommentaryAudio
        commentary={data.commentary ?? null}
        currentTime={time}
        playing={playback.playing}
        speed={playback.speed}
      />
    ),
    playback: <PlaybackControls playback={playback} duration={data.duration} raceStart={data.race_start} markers={markers} />,
  }

  return (
    <PanelGrid
      scopeKey={session}
      category={sessionCategory(session)}
      sessionDefault={sessionDefault}
      panelDefs={PANEL_DEFS}
      panels={panels}
    />
  )
}
