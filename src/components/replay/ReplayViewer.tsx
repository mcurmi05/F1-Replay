import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactGridLayout, { noCompactor } from 'react-grid-layout'
import type { Layout, ResizeHandleAxis } from 'react-grid-layout'

import StatusCard from '../StatusCard'
import CommentaryAudio from './CommentaryAudio'
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
import { usePersistedLayout } from '../../hooks/usePersistedLayout'
import { useReplayLayout } from '../../hooks/useReplayLayout'
import { BASE_COLS, COLS, FINE } from '../../lib/layoutGrid'
import { defaultsFor } from '../../lib/defaultLayouts'
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

const LAYOUT_STORAGE_KEY = 'f1replay.replayLayout.v10'
const GRID_MARGIN = 8
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
  { id: 'teamRadio',   label: 'Team Radio' },
  { id: 'sessionBests', label: 'Session Bests' },
  { id: 'speedTrap',   label: 'Speed Trap' },
  { id: 'commentary',  label: 'Commentary' },
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
    <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl border-2 border-dashed border-f1-red" />
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

function firstFreeY(items: Layout, w: number, h: number): number {
  let y = 0
  while (items.some((o) => w > o.x && y < o.y + o.h && y + h > o.y)) {
    y++
  }
  return y
}

function mergeMissingPanels(current: Layout, defaults: Layout): Layout {
  const present = new Set(current.map((i) => i.i))
  const missing = defaults.filter((d) => !present.has(d.i))
  if (missing.length === 0) return current
  const merged = [...current]
  for (const d of missing) {
    merged.push({ ...d, x: 0, y: firstFreeY(merged, d.w, d.h) })
  }
  return merged
}

function calcGrid(windowW: number, windowH: number) {
  const gridW = windowW - PAD_H
  const baseColWidth = Math.max(16, Math.floor((gridW - (BASE_COLS - 1) * GRID_MARGIN) / BASE_COLS))
  const availH = windowH - HEADER_H - PAD_TOP
  const baseRows = Math.max(1, Math.floor(availH / (baseColWidth + GRID_MARGIN)))
  const totalRows = baseRows * FINE
  const rowHeight = Math.max(2, availH / totalRows - GRID_MARGIN)
  return { gridWidth: gridW, rowHeight, totalRows }
}

function DragHandle({ title }: { title: string }) {
  return (
    <div className="panel-drag-handle absolute -top-3 left-1/2 z-30 flex -translate-x-1/2 cursor-move items-center gap-1.5 rounded-full border border-f1-red/60 bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-100 shadow-lg">
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
  const sessionDefault = useMemo(() => defaultsFor(session), [session])
  const defaultLayout = sessionDefault.layout
  const { layout, setLayout, reset } = usePersistedLayout(`${LAYOUT_STORAGE_KEY}.${session}`, defaultLayout)
  const [grid, setGrid] = useState(() => calcGrid(window.innerWidth, window.innerHeight))

  useEffect(() => {
    const onResize = () => setGrid(calcGrid(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const { editMode, setActive, setEditMode, setTitleInfo, setStatusInfo, setSessionNav, registerReset, hiddenPanels, hidePanel, showPanel, registerPanelDefs, registerShowPanel, registerLayoutAccessors, timingColumns, setTimingColumns, applyScope } = useReplayLayout()
  const { data: schedule } = useSchedule(year)

  useEffect(() => {
    applyScope(session, sessionDefault)
  }, [session, sessionDefault, applyScope])

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

  useEffect(() => {
    registerPanelDefs(PANEL_DEFS)
    return () => registerPanelDefs([])
  }, [registerPanelDefs])

  const fullLayout = useMemo(() => mergeMissingPanels(layout, defaultLayout), [layout, defaultLayout])

  const layoutRef = useRef(fullLayout)
  useEffect(() => { layoutRef.current = fullLayout }, [fullLayout])
  const hiddenPanelsRef = useRef(hiddenPanels)
  useEffect(() => { hiddenPanelsRef.current = hiddenPanels }, [hiddenPanels])

  const handleShowPanel = useCallback((id: string) => {
    const visible = layoutRef.current.filter((item) => !hiddenPanelsRef.current.has(item.i))
    const current = layoutRef.current.find((item) => item.i === id)
    const w = current?.w ?? 6
    const h = current?.h ?? 4
    const targetY = firstFreeY(visible, w, h)
    setLayout(layoutRef.current.map((item) => item.i === id ? { ...item, x: 0, y: targetY } : item))
    showPanel(id)
  }, [showPanel, setLayout])

  useEffect(() => {
    registerShowPanel(handleShowPanel)
    return () => registerShowPanel(null)
  }, [registerShowPanel, handleShowPanel])

  useEffect(() => {
    registerLayoutAccessors(
      () => layoutRef.current,
      (l) => setLayout(l),
    )
    return () => registerLayoutAccessors(null, null)
  }, [registerLayoutAccessors, setLayout])

  const visibleLayout = fullLayout.filter((item) => !hiddenPanels.has(item.i))

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
          <StatusCard text="This session has no position data, so a track replay is not available." />
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
  }
  const board = lapMode ? lapLeaderboard(data, time, qStatus.segment) : leaderboard(data, time)
  const pitLabel = session === 'R' || session === 'Sprint' ? 'Race' : isQualifying ? 'Qualifying' : 'Practice'

  const panelOutline = editMode ? 'relative h-full cursor-move select-none' : 'relative h-full'
  const panelZ = (id: string): React.CSSProperties | undefined =>
    editMode ? { zIndex: (visibleLayout.find((i) => i.i === id)?.y ?? 0) + 1 } : undefined

  return (
    <div>
      <ReactGridLayout
        width={grid.gridWidth}
        layout={visibleLayout}
        onDragStop={(l) => setLayout([...l, ...fullLayout.filter((item) => hiddenPanels.has(item.i))])}
        onResizeStop={(l) => setLayout([...l, ...fullLayout.filter((item) => hiddenPanels.has(item.i))])}
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
                <TrackMap replay={data} currentTime={time} selected={selected} onSelect={setSelected} editMode={editMode} />
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
              columns={timingColumns}
              onColumnsChange={setTimingColumns}
              header={<ReplayClock relative={clockRelative} lap={lap} totalLaps={data.total_laps} label={segmentLabel} hideHours={isQualifying} />}
            />
          </div>
          )}
          {!hiddenPanels.has('teamRadio') && (
          <div key="teamRadio" className={panelOutline} style={panelZ('teamRadio')}>
            {editMode ? <DragHandle title="Team Radio" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('teamRadio')} /> : null}
            <TeamRadioFeed replay={data} currentTime={time} />
          </div>
          )}
          {!hiddenPanels.has('sessionBests') && (
          <div key="sessionBests" className={panelOutline} style={panelZ('sessionBests')}>
            {editMode ? <DragHandle title="Session Bests" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('sessionBests')} /> : null}
            <SessionBestsFeed replay={data} currentTime={time} />
          </div>
          )}
          {!hiddenPanels.has('speedTrap') && (
          <div key="speedTrap" className={panelOutline} style={panelZ('speedTrap')}>
            {editMode ? <DragHandle title="Speed Trap" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('speedTrap')} /> : null}
            <SpeedTrapFeed replay={data} currentTime={time} />
          </div>
          )}
          {!hiddenPanels.has('commentary') && (
          <div key="commentary" className={panelOutline} style={panelZ('commentary')}>
            {editMode ? <DragHandle title="Commentary" /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel('commentary')} /> : null}
            <CommentaryAudio
              commentary={data.commentary ?? null}
              currentTime={time}
              playing={playback.playing}
              speed={playback.speed}
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
