import { useMemo, useState } from 'react'

import StatusCard from '../StatusCard'
import OvertakeFeed from './OvertakeFeed'
import PitStopFeed from './PitStopFeed'
import PlaybackControls from './PlaybackControls'
import RaceControlFeed from './RaceControlFeed'
import ReplayClock from './ReplayClock'
import TelemetryPanel from './TelemetryPanel'
import TimingTower from './TimingTower'
import TrackMap from './TrackMap'
import { useReplay } from '../../hooks/useApi'
import { usePlayback } from '../../hooks/usePlayback'
import {
  currentLapNumber,
  currentTrackStatus,
  leaderboard,
  overtakeEvents,
  trackStatusInfo,
} from '../../lib/replay'

export default function ReplayViewer({
  year,
  event,
  session,
}: {
  year: number
  event: string
  session: string
}) {
  const { data, error, loading } = useReplay(year, event, session)
  const playback = usePlayback(data?.duration ?? 0)
  const [selected, setSelected] = useState<string | null>(null)
  const events = useMemo(() => (data ? overtakeEvents(data) : []), [data])

  if (loading) {
    return <StatusCard text="Loading replay data..." />
  }
  if (error) {
    return <StatusCard text={`Could not load replay: ${error.message}`} />
  }
  if (!data) {
    return null
  }
  if (!data.available) {
    return <StatusCard text="This session has no position data, so a track replay is not available." />
  }

  const time = playback.currentTime
  const relative = data.race_start === null ? null : time - data.race_start
  const lap = currentLapNumber(data, time)
  const board = leaderboard(data, time)
  const status = trackStatusInfo(currentTrackStatus(data.track_status, time)?.code ?? null)

  return (
    <div className="space-y-4">
      <ReplayClock relative={relative} lap={lap} totalLaps={data.total_laps} />
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_300px]" style={{ overflowAnchor: 'none' }}>
        <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-surface" style={{ contain: 'layout', overflowAnchor: 'none' }}>
          <div className="absolute inset-0 overflow-hidden p-3" style={{ overflowAnchor: 'none' }}>
            <TrackMap replay={data} currentTime={time} selected={selected} onSelect={setSelected} />
          </div>
          <div
            className="absolute left-3 top-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            style={{ color: status.color, backgroundColor: status.background }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
            {status.label}
          </div>
        </div>
        <div>
          <TimingTower rows={board} selected={selected} onSelect={setSelected} />
        </div>
      </div>
      <PlaybackControls playback={playback} duration={data.duration} raceStart={data.race_start} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RaceControlFeed messages={data.race_control_messages} currentTime={time} />
        <PitStopFeed replay={data} currentTime={time} />
        <div className={selected ? '' : 'hidden'}>
          {selected ? <TelemetryPanel year={year} event={event} session={session} replay={data} driver={selected} currentTime={time} /> : null}
        </div>
      </div>
      <OvertakeFeed events={events} currentTime={time} />
    </div>
  )
}
