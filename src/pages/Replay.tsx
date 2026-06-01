import { Link, useParams } from 'react-router-dom'

import { ArrowRightIcon } from '../components/icons'
import { useSession } from '../hooks/useApi'
import { formatLapTime } from '../lib/format'
import type { SessionData } from '../lib/api/types'

function teamColour(value: string | null) {
  if (!value) {
    return '#71717a'
  }
  return value.startsWith('#') ? value : `#${value}`
}

function StatusCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-8 text-zinc-400">
      {text}
    </div>
  )
}

function SessionView({ data }: { data: SessionData }) {
  const { summary, results, laps } = data
  const ordered = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  const fastest = laps
    .map((lap) => lap.lap_time)
    .filter((value): value is number => value !== null)
    .reduce((min, value) => (value < min ? value : min), Number.POSITIVE_INFINITY)

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
          <span>{laps.length} laps recorded</span>
          {Number.isFinite(fastest) ? (
            <>
              <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
              <span>Fastest lap {formatLapTime(fastest)}</span>
            </>
          ) : null}
        </div>
      </div>

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
                      style={{ backgroundColor: teamColour(row.team_colour) }}
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
      </div>
    </div>
  )
}

export default function Replay() {
  const { year, event, session } = useParams<{
    year: string
    event: string
    session: string
  }>()

  const yearNumber = Number(year)
  const ready = Boolean(year && event && session) && !Number.isNaN(yearNumber)
  const { data, error, loading } = useSession(yearNumber, event ?? '', session ?? '', ready)

  return (
    <div className="space-y-6">
      <Link
        to="/home"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowRightIcon className="h-4 w-4 rotate-180" />
        Back to home
      </Link>

      {loading ? <StatusCard text="Loading session..." /> : null}
      {error ? <StatusCard text={`Could not load session: ${error.message}`} /> : null}
      {data ? <SessionView data={data} /> : null}
    </div>
  )
}
