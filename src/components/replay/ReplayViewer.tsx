import { useEffect, useState } from 'react'
import ReactGridLayout, { useContainerWidth } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'

import StatusCard from '../StatusCard'
import PitStopFeed from './PitStopFeed'
import PlaybackControls from './PlaybackControls'
import RaceControlFeed from './RaceControlFeed'
import ReplayClock from './ReplayClock'
import ReplayTitle from './ReplayTitle'
import TelemetryPanel from './TelemetryPanel'
import TimingTower from './TimingTower'
import TrackMap from './TrackMap'
import WeatherPanel from './WeatherPanel'
import { useReplay } from '../../hooks/useApi'
import { usePlayback } from '../../hooks/usePlayback'
import { usePersistedLayout } from '../../hooks/usePersistedLayout'
import { useReplayLayout } from '../../hooks/useReplayLayout'
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

const LAYOUT_STORAGE_KEY = 'f1replay.replayLayout.v2'

function DragHandle({ title }: { title: string }) {
  return (
    <div className="panel-drag-handle absolute -top-3 left-1/2 z-30 flex -translate-x-1/2 cursor-move items-center gap-1.5 rounded-full border border-sky-500/60 bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-100 shadow-lg">
      <span className="tracking-[0.25em] text-zinc-400">:::</span>
      {title}
    </div>
  )
}

const DEFAULT_LAYOUT: Layout = [
  { i: 'title', x: 0, y: 0, w: 8, h: 3, minW: 4, minH: 2 },
  { i: 'timingTower', x: 8, y: 0, w: 4, h: 16, minW: 3, minH: 6 },
  { i: 'trackmap', x: 0, y: 3, w: 4, h: 10, minW: 3, minH: 6 },
  { i: 'raceControl', x: 4, y: 3, w: 2, h: 5, minW: 2, minH: 3 },
  { i: 'pitStops', x: 6, y: 3, w: 2, h: 5, minW: 2, minH: 3 },
  { i: 'telemetry', x: 4, y: 8, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'playback', x: 0, y: 13, w: 8, h: 2, minW: 3, minH: 2 },
]

export default function ReplayViewer({
  year,
  event,
  session,
  summary,
  lapCount,
}: {
  year: number
  event: string
  session: string
  summary: SessionSummary
  lapCount: number
}) {
  const { data, error, loading } = useReplay(year, event, session)
  const playback = usePlayback(data?.duration ?? 0)
  const [selected, setSelected] = useState<string | null>(null)
  const { width, containerRef, mounted } = useContainerWidth()
  const { layout, setLayout, reset } = usePersistedLayout(LAYOUT_STORAGE_KEY, DEFAULT_LAYOUT)
  const { editMode, setActive, setEditMode, registerReset } = useReplayLayout()

  useEffect(() => {
    setActive(true)
    registerReset(reset)
    return () => {
      setActive(false)
      setEditMode(false)
      registerReset(null)
    }
  }, [setActive, setEditMode, registerReset, reset])

  if (loading || error || !data || !data.available) {
    return (
      <div className="space-y-4">
        <ReplayTitle summary={summary} lapCount={lapCount} />
        {loading ? <StatusCard text="Loading replay data..." /> : null}
        {error ? <StatusCard text={`Could not load replay: ${error.message}`} /> : null}
        {!loading && !error && (!data || !data.available) ? (
          <StatusCard text="This session has no position data, so a track replay is not available." />
        ) : null}
      </div>
    )
  }

  const time = playback.currentTime
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
  }
  const board = lapMode ? lapLeaderboard(data, time, qStatus.segment) : leaderboard(data, time)
  const pitLabel = session === 'R' || session === 'Sprint' ? 'Race' : isQualifying ? 'Qualifying' : 'Practice'
  const effectiveFlag = mergeFlagCodes(
    currentTrackStatus(data.track_status, time)?.code ?? null,
    currentRaceControlFlag(data.race_control_messages, time),
  )
  const status = trackStatusInfo(effectiveFlag)
  const weather = currentWeather(data.weather, time)

  const panelOutline = editMode
    ? 'relative h-full cursor-move select-none rounded-2xl outline-dashed outline-2 -outline-offset-2 outline-sky-500/70'
    : 'relative h-full'

  return (
    <div ref={containerRef}>
      {mounted ? (
        <ReactGridLayout
          width={width}
          layout={layout}
          onLayoutChange={setLayout}
          gridConfig={{ cols: 12, rowHeight: 30, margin: [16, 16] }}
          dragConfig={{ enabled: editMode, cancel: '.react-resizable-handle' }}
          resizeConfig={{ enabled: editMode }}
        >
          <div key="title" className={panelOutline}>
            {editMode ? <DragHandle title="Title" /> : null}
            <ReplayTitle summary={summary} lapCount={lapCount} />
          </div>
          <div key="trackmap" className={panelOutline}>
            {editMode ? <DragHandle title="Track Map" /> : null}
            <div className="relative h-full w-full overflow-hidden rounded-2xl border border-zinc-800 bg-surface">
              <div className="absolute inset-0 overflow-hidden p-3">
                <TrackMap replay={data} currentTime={time} selected={selected} onSelect={setSelected} />
              </div>
              <div className="absolute right-3 top-3 z-10 flex w-32 flex-col gap-2">
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold"
                  style={{ color: status.color, backgroundColor: status.background }}
                >
                  <img src={status.flag} alt="" className="h-5 w-5" />
                  {status.label}
                </div>
                <WeatherPanel weather={weather} />
              </div>
            </div>
          </div>
          <div key="raceControl" className={panelOutline}>
            {editMode ? <DragHandle title="Race Control" /> : null}
            <RaceControlFeed messages={data.race_control_messages} currentTime={time} />
          </div>
          <div key="pitStops" className={panelOutline}>
            {editMode ? <DragHandle title="Pit Stops" /> : null}
            <PitStopFeed replay={data} currentTime={time} label={pitLabel} />
          </div>
          <div key="telemetry" className={panelOutline}>
            {editMode ? <DragHandle title="Telemetry" /> : null}
            {selected ? (
              <TelemetryPanel year={year} event={event} session={session} replay={data} driver={selected} currentTime={time} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-surface p-5 text-center text-sm text-zinc-500">
                Select a driver to view telemetry
              </div>
            )}
          </div>
          <div key="timingTower" className={panelOutline}>
            {editMode ? <DragHandle title="Timing Tower" /> : null}
            <TimingTower
              rows={board}
              selected={selected}
              onSelect={setSelected}
              mode={lapMode ? 'lap' : 'race'}
              header={<ReplayClock relative={clockRelative} lap={lap} totalLaps={data.total_laps} label={segmentLabel} hideHours={isQualifying} />}
            />
          </div>
          <div key="playback" className={panelOutline}>
            {editMode ? <DragHandle title="Playback" /> : null}
            <PlaybackControls playback={playback} duration={data.duration} raceStart={data.race_start} markers={markers} />
          </div>
        </ReactGridLayout>
      ) : null}
    </div>
  )
}
