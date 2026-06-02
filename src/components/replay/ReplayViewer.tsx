import { useState } from 'react'

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
import {
  currentLapNumber,
  currentTrackStatus,
  currentWeather,
  lapLeaderboard,
  leaderboard,
  qualifyingStatus,
  trackStatusInfo,
} from '../../lib/replay'
import type { SessionSummary } from '../../lib/api/types'

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
  const status = trackStatusInfo(currentTrackStatus(data.track_status, time)?.code ?? null)
  const weather = currentWeather(data.weather, time)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]" style={{ overflowAnchor: 'none' }}>
        <div className="flex flex-col gap-4">
          <ReplayTitle summary={summary} lapCount={lapCount} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2" style={{ overflowAnchor: 'none' }}>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-zinc-800 bg-surface" style={{ contain: 'layout', overflowAnchor: 'none' }}>
              <div className="absolute inset-0 overflow-hidden p-3" style={{ overflowAnchor: 'none' }}>
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
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RaceControlFeed messages={data.race_control_messages} currentTime={time} />
                <PitStopFeed replay={data} currentTime={time} label={pitLabel} />
              </div>
              {selected ? (
                <TelemetryPanel year={year} event={event} session={session} replay={data} driver={selected} currentTime={time} />
              ) : null}
            </div>
          </div>
          <div className="mt-auto">
            <PlaybackControls playback={playback} duration={data.duration} raceStart={data.race_start} markers={markers} />
          </div>
        </div>
        <div>
          <TimingTower
            rows={board}
            selected={selected}
            onSelect={setSelected}
            mode={lapMode ? 'lap' : 'race'}
            header={<ReplayClock relative={clockRelative} lap={lap} totalLaps={data.total_laps} label={segmentLabel} hideHours={isQualifying} />}
          />
        </div>
      </div>
    </div>
  )
}
