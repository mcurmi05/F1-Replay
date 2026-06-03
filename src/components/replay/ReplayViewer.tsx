import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactGridLayout, { noCompactor } from 'react-grid-layout'
import type { Layout, ResizeHandleAxis } from 'react-grid-layout'

import StatusCard from '../StatusCard'
import PitStopFeed from './PitStopFeed'
import PlaybackControls from './PlaybackControls'
import RaceControlFeed from './RaceControlFeed'
import ReplayClock from './ReplayClock'
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

const LAYOUT_STORAGE_KEY = 'f1replay.replayLayout.v8'
const GRID_MARGIN = 8
const COLS = 32
const HEADER_H = 64
const PAD_TOP = 16
const PAD_H = 32
const FREE_COMPACTOR = { ...noCompactor, preventCollision: true }
const RESIZE_HANDLES: ResizeHandleAxis[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

const PANEL_DEFS = [
  { id: 'trackmap',    label: 'Track Map' },
  { id: 'raceControl', label: 'Race Control' },
  { id: 'pitStops',    label: 'Pit Stops' },
  { id: 'telemetry',   label: 'Telemetry' },
  { id: 'timingTower', label: 'Timing Tower' },
  { id: 'playback',    label: 'Playback' },
]
const RESIZE_EDGE = 8
const RESIZE_CORNER = 14

function renderResizeHandle(axis: ResizeHandleAxis, ref: React.Ref<HTMLElement>) {
  const e = RESIZE_EDGE
  const c = RESIZE_CORNER
  const style: React.CSSProperties =
    axis === 'n'  ? { top: 0,    left: c, right: c, width: 'auto', height: e, cursor: 'ns-resize' } :
    axis === 's'  ? { bottom: 0, left: c, right: c, width: 'auto', height: e, cursor: 'ns-resize' } :
    axis === 'e'  ? { right: 0,  top: c,  bottom: c, width: e, height: 'auto', cursor: 'ew-resize' } :
    axis === 'w'  ? { left: 0,   top: c,  bottom: c, width: e, height: 'auto', cursor: 'ew-resize' } :
    axis === 'ne' ? { top: 0,    right: 0,  width: c, height: c, cursor: 'ne-resize' } :
    axis === 'nw' ? { top: 0,    left: 0,   width: c, height: c, cursor: 'nw-resize' } :
    axis === 'se' ? { bottom: 0, right: 0,  width: c, height: c, cursor: 'se-resize' } :
                    { bottom: 0, left: 0,   width: c, height: c, cursor: 'sw-resize' }
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className="react-resizable-handle"
      style={{ position: 'absolute', backgroundImage: 'none', zIndex: 25, ...style }}
    />
  )
}

function EditBorder() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl border-2 border-dashed border-sky-400" />
  )
}

function HidePanelButton({ onHide }: { onHide: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onHide() }}
      className="absolute right-1.5 top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-400 hover:border-zinc-500 hover:text-white"
      title="Hide panel"
    >
      <svg viewBox="0 0 8 8" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth="1.5" fill="none">
        <path d="M1 1l6 6M7 1l-6 6" />
      </svg>
    </button>
  )
}

function buildDefaultLayout(): Layout {
  return [
    { i: 'timingTower', x: 21, y: 0, w: 11, h: 16, minW: 6, minH: 6 },
    { i: 'trackmap',    x: 0,  y: 0, w: 10, h: 8,  minW: 4, minH: 4 },
    { i: 'raceControl', x: 10, y: 0, w: 6,  h: 4,  minW: 2, minH: 2 },
    { i: 'pitStops',    x: 16, y: 0, w: 5,  h: 4,  minW: 2, minH: 2 },
    { i: 'telemetry',   x: 10, y: 4, w: 11, h: 4,  minW: 4, minH: 2 },
    { i: 'playback',    x: 0,  y: 8, w: 21, h: 2,  minW: 6, minH: 2 },
  ]
}

function calcGrid(windowW: number, windowH: number) {
  const gridW = windowW - PAD_H
  const colWidth = Math.max(16, Math.floor((gridW - (COLS - 1) * GRID_MARGIN) / COLS))
  const availH = windowH - HEADER_H - PAD_TOP
  const totalRows = Math.max(1, Math.floor(availH / (colWidth + GRID_MARGIN)))
  const rowHeight = availH / totalRows - GRID_MARGIN
  return { gridWidth: gridW, rowHeight, totalRows }
}

function DragHandle({ title }: { title: string }) {
  return (
    <div className="panel-drag-handle absolute -top-3 left-1/2 z-30 flex -translate-x-1/2 cursor-move items-center gap-1.5 rounded-full border border-sky-500/60 bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-100 shadow-lg">
      <span className="tracking-[0.25em] text-zinc-400">:::</span>
      {title}
    </div>
  )
}

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
  const defaultLayout = useMemo(() => buildDefaultLayout(), [])
  const { layout, setLayout, reset } = usePersistedLayout(LAYOUT_STORAGE_KEY, defaultLayout)
  const [grid, setGrid] = useState(() => calcGrid(window.innerWidth, window.innerHeight))

  useEffect(() => {
    const onResize = () => setGrid(calcGrid(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const { editMode, setActive, setEditMode, setTitleInfo, registerReset, hiddenPanels, hidePanel, showPanel, registerPanelDefs, registerShowPanel } = useReplayLayout()

  useEffect(() => {
    setActive(true)
    registerReset(reset)
    return () => {
      setActive(false)
      setEditMode(false)
      registerReset(null)
    }
  }, [setActive, setEditMode, registerReset, reset])

  useEffect(() => {
    setTitleInfo({ eventName: summary.event_name, sessionName: summary.session_name, location: summary.location })
    return () => setTitleInfo(null)
  }, [summary.event_name, summary.session_name, summary.location, setTitleInfo])

  useEffect(() => {
    registerPanelDefs(PANEL_DEFS)
    return () => registerPanelDefs([])
  }, [registerPanelDefs])

  const layoutRef = useRef(layout)
  useEffect(() => { layoutRef.current = layout }, [layout])
  const hiddenPanelsRef = useRef(hiddenPanels)
  useEffect(() => { hiddenPanelsRef.current = hiddenPanels }, [hiddenPanels])

  const handleShowPanel = useCallback((id: string) => {
    const visible = layoutRef.current.filter((item) => !hiddenPanelsRef.current.has(item.i))
    const current = layoutRef.current.find((item) => item.i === id)
    const w = current?.w ?? 6
    const h = current?.h ?? 4
    let targetY = 0
    while (visible.some((o) => w > o.x && targetY < o.y + o.h && targetY + h > o.y)) {
      targetY++
    }
    setLayout((prev) => prev.map((item) => item.i === id ? { ...item, x: 0, y: targetY } : item))
    showPanel(id)
  }, [showPanel, setLayout])

  useEffect(() => {
    registerShowPanel(handleShowPanel)
    return () => registerShowPanel(null)
  }, [registerShowPanel, handleShowPanel])

  const visibleLayout = layout.filter((item) => !hiddenPanels.has(item.i))

  if (loading || error || !data || !data.available) {
    return (
      <div className="space-y-4">
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

  const panelOutline = editMode ? 'relative h-full cursor-move select-none' : 'relative h-full'
  const panelZ = (id: string): React.CSSProperties | undefined =>
    editMode ? { zIndex: (visibleLayout.find((i) => i.i === id)?.y ?? 0) + 1 } : undefined

  return (
    <div>
      <ReactGridLayout
        width={grid.gridWidth}
        layout={visibleLayout}
        onDragStop={(l) => setLayout([...l, ...layout.filter((item) => hiddenPanels.has(item.i))])}
        onResizeStop={(l) => setLayout([...l, ...layout.filter((item) => hiddenPanels.has(item.i))])}
        gridConfig={{ cols: COLS, rowHeight: grid.rowHeight, margin: [GRID_MARGIN, GRID_MARGIN], containerPadding: [0, 0] }}
        dragConfig={{ enabled: editMode, cancel: '.react-resizable-handle' }}
        resizeConfig={{ enabled: editMode, handles: RESIZE_HANDLES, handleComponent: renderResizeHandle }}
        compactor={FREE_COMPACTOR}
      >
          {!hiddenPanels.has('trackmap') && (
          <div key="trackmap" className={panelOutline} style={panelZ('trackmap')}>
            {editMode ? <DragHandle title="Track Map" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('trackmap')} /> : null}
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
          )}
          {!hiddenPanels.has('raceControl') && (
          <div key="raceControl" className={panelOutline} style={panelZ('raceControl')}>
            {editMode ? <DragHandle title="Race Control" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('raceControl')} /> : null}
            <RaceControlFeed messages={data.race_control_messages} currentTime={time} />
          </div>
          )}
          {!hiddenPanels.has('pitStops') && (
          <div key="pitStops" className={panelOutline} style={panelZ('pitStops')}>
            {editMode ? <DragHandle title="Pit Stops" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('pitStops')} /> : null}
            <PitStopFeed replay={data} currentTime={time} label={pitLabel} />
          </div>
          )}
          {!hiddenPanels.has('telemetry') && (
          <div key="telemetry" className={panelOutline} style={panelZ('telemetry')}>
            {editMode ? <DragHandle title="Telemetry" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('telemetry')} /> : null}
            {selected ? (
              <TelemetryPanel year={year} event={event} session={session} replay={data} driver={selected} currentTime={time} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-surface p-5 text-center text-sm text-zinc-500">
                Select a driver to view telemetry
              </div>
            )}
          </div>
          )}
          {!hiddenPanels.has('timingTower') && (
          <div key="timingTower" className={panelOutline} style={panelZ('timingTower')}>
            {editMode ? <DragHandle title="Timing Tower" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('timingTower')} /> : null}
            <TimingTower
              rows={board}
              selected={selected}
              onSelect={setSelected}
              mode={lapMode ? 'lap' : 'race'}
              header={<ReplayClock relative={clockRelative} lap={lap} totalLaps={data.total_laps} label={segmentLabel} hideHours={isQualifying} />}
            />
          </div>
          )}
          {!hiddenPanels.has('playback') && (
          <div key="playback" className={panelOutline} style={panelZ('playback')}>
            {editMode ? <DragHandle title="Playback" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('playback')} /> : null}
            <PlaybackControls playback={playback} duration={data.duration} raceStart={data.race_start} markers={markers} />
          </div>
          )}
        </ReactGridLayout>
    </div>
  )
}
