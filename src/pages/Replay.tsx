import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ArrowRightIcon } from '../components/icons'
import StatusCard from '../components/StatusCard'
import ReplayViewer from '../components/replay/ReplayViewer'
import { useSession } from '../hooks/useApi'
import { api } from '../lib/api/client'
import { formatLapTime, teamColor } from '../lib/format'
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
  const { summary, results, laps } = data
  const [revealed, setRevealed] = useState(false)
  const ordered = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  type TimedLap = (typeof laps)[0] & { lap_time: number }
  const fastestLap = laps
    .filter((lap): lap is TimedLap => lap.lap_time !== null)
    .reduce<TimedLap | null>(
      (best, lap) => (best === null || lap.lap_time < best.lap_time ? lap : best),
      null,
    )
  const fastest = fastestLap?.lap_time ?? Number.POSITIVE_INFINITY
  const fastestDriver = fastestLap
    ? results.find((r) => r.driver_number === fastestLap.driver_number)
    : null

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-surface p-6">
        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-400">
          REPLAY
        </span>
        <h1 className="mt-4 text-3xl font-bold text-white">{summary.event_name}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          <span>{summary.session_name}</span>
          <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
          <span>{summary.location}</span>
          <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
          <span>{laps.length} total laps recorded</span>
        </div>
      </div>

      <ReplayViewer year={year} event={event} session={session} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Results</h2>
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800"
          >
            {revealed ? 'Hide results' : 'Reveal results'}
          </button>
        </div>
        {revealed ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Pos</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Team</th>
                  <th className="px-5 py-3 text-right font-medium">Points</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((row) => (
                  <tr
                    key={row.driver_number ?? row.abbreviation}
                    className="border-b border-zinc-800/60 last:border-0"
                  >
                    <td className="px-5 py-3 font-mono text-zinc-400">{row.position ?? '-'}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: teamColor(row.team_colour) }}
                        />
                        <span className="font-medium text-white">
                          {row.abbreviation ?? row.full_name}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">{row.team_name}</td>
                    <td className="px-5 py-3 text-right text-zinc-300">{row.points ?? 0}</td>
                    <td className="px-5 py-3 text-zinc-400">{row.status ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Number.isFinite(fastest) ? (
              <div className="border-t border-zinc-800 px-5 py-3 text-sm text-zinc-400">
                Fastest lap{' '}
                <span className="font-medium text-white">{formatLapTime(fastest)}</span>
                {fastestDriver?.abbreviation ? (
                  <>
                    {' · '}
                    <span className="font-medium text-white">{fastestDriver.abbreviation}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-surface p-8 text-center text-sm text-zinc-500">
            Results hidden for spoiler-free viewing. Reveal when you are ready.
          </div>
        )}
      </div>
    </div>
  )
}

export default function Replay() {
  const { year, event, session } = useParams<{ year: string; event: string; session: string }>()
  const yearNumber = Number(year)
  const ready = Boolean(year && event && session) && !Number.isNaN(yearNumber)
  const { data, error, loading } = useSession(yearNumber, event ?? '', session ?? '', ready)

  const [isCached, setIsCached] = useState<boolean | null>(null)
  const checkedKey = useRef<string | null>(null)

  useEffect(() => {
    if (!ready) {
      return
    }
    const key = `${year}:${event}:${session}`
    if (checkedKey.current === key) {
      return
    }
    checkedKey.current = key
    setIsCached(null)
    api
      .sessionCached(yearNumber, event ?? '', session ?? '')
      .then((result) => setIsCached(result.cached))
      .catch(() => setIsCached(false))
  }, [ready, year, event, session, yearNumber])

  return (
    <div className="space-y-6">
      <Link
        to="/home"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowRightIcon className="h-4 w-4 rotate-180" />
        Back to home
      </Link>

      {loading ? (
        <div className="rounded-2xl border border-zinc-800 bg-surface p-8">
          <p className="text-base font-semibold text-white">
            {isCached ? 'Fetching cached session data...' : 'Downloading session data...'}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {isCached
              ? 'Loading from your local cache.'
              : 'This may take a moment for sessions not yet cached.'}
          </p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-f1-red"
              style={{
                animation: `session-download ${isCached ? '4s' : '25s'} cubic-bezier(0.1, 0.4, 0.2, 1) forwards`,
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
