import { useParams } from 'react-router-dom'

import StatusCard from '../components/StatusCard'
import ReplayViewer from '../components/replay/ReplayViewer'
import { useSession } from '../hooks/useApi'
import type { SessionData } from '../lib/api/types'

function SessionView({
  data,
  year,
  event,
  session,
}: {
  data: SessionData
  year: number
  event: string
  session: string
}) {
  const { summary } = data

  return (
    <ReplayViewer
      year={year}
      event={event}
      session={session}
      summary={summary}
    />
  )
}

export default function Replay() {
  const { year, event, session } = useParams<{ year: string; event: string; session: string }>()
  const yearNumber = Number(year)
  const ready = Boolean(year && event && session) && !Number.isNaN(yearNumber)
  const { data, error, loading } = useSession(yearNumber, event ?? '', session ?? '', ready)

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-zinc-800 bg-surface p-8">
          <p className="text-base font-semibold text-white">Fetching session data...</p>
          <p className="mt-1 text-sm text-zinc-500">This may take a moment.</p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-f1-red"
              style={{
                animation: 'session-download 20s cubic-bezier(0.1, 0.4, 0.2, 1) forwards',
              }}
            />
          </div>
        </div>
      ) : null}
      {error ? <StatusCard text={`Could not load session: ${error.message}`} /> : null}
      {data ? (
        <SessionView data={data} year={yearNumber} event={event ?? ''} session={session ?? ''} />
      ) : null}
    </div>
  )
}
