import { useState } from 'react'

import StatusCard from '../StatusCard'
import PlaybackControls from './PlaybackControls'
import TrackMap from './TrackMap'
import { useReplay } from '../../hooks/useApi'
import { usePlayback } from '../../hooks/usePlayback'

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

  if (loading) {
    return <StatusCard text="Loading replay data..." />
  }
  if (error) {
    return <StatusCard text={`Could not load replay: ${error.message}`} />
  }
  if (!data) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-surface p-3">
        <TrackMap
          replay={data}
          currentTime={playback.currentTime}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      <PlaybackControls playback={playback} duration={data.duration} />
    </div>
  )
}
