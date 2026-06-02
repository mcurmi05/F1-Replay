import { useLive } from '../hooks/useApi'
import { compoundInfo } from '../lib/replay'
import { teamColor } from '../lib/format'
import type { LiveRow, LiveState } from '../lib/api/types'

function trackStatusStyle(message: string): string {
  const text = message.toLowerCase()
  if (text.includes('red')) {
    return 'border-red-500/40 bg-red-500/15 text-red-400'
  }
  if (text.includes('safety') || text.includes('vsc')) {
    return 'border-amber-500/40 bg-amber-500/15 text-amber-400'
  }
  if (text.includes('yellow')) {
    return 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300'
  }
  if (text.includes('clear')) {
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
  }
  return 'border-zinc-700 bg-zinc-900/60 text-zinc-400'
}

function countdown(startUtc: string): string {
  const diff = new Date(startUtc).getTime() - Date.now()
  if (diff <= 0) {
    return 'starting soon'
  }
  const minutes = Math.floor(diff / 60000)
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)
  const mins = minutes % 60
  if (days > 0) {
    return `in ${days}d ${hours}h`
  }
  if (hours > 0) {
    return `in ${hours}h ${mins}m`
  }
  return `in ${mins}m`
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
      {children}
    </span>
  )
}

function Header({ state }: { state: LiveState }) {
  const session = state.session
  if (!session) {
    return null
  }
  const isLive = state.live
  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        {isLive ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-f1-red/40 bg-f1-red/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-f1-red">
            <span className="h-2 w-2 animate-pulse rounded-full bg-f1-red" />
            Live
          </span>
        ) : (
          <Pill>{state.source === 'historical' ? 'Latest result' : 'Session'}</Pill>
        )}
        {session.track_status.message ? (
          <span
            className={[
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider',
              trackStatusStyle(session.track_status.message),
            ].join(' ')}
          >
            {session.track_status.message}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{session.event_name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {session.session_name}
            {session.location ? ` · ${session.location}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {session.total_laps ? (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Lap</p>
              <p className="font-mono text-lg font-semibold text-white">
                {session.current_lap ?? '-'}
                <span className="text-zinc-600"> / {session.total_laps}</span>
              </p>
            </div>
          ) : null}
          {session.time_remaining ? (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Remaining</p>
              <p className="font-mono text-lg font-semibold text-white">{session.time_remaining}</p>
            </div>
          ) : null}
        </div>
      </div>

      {state.weather ? (
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-800 pt-4 text-sm">
          {state.weather.air_temp !== null ? (
            <span className="text-zinc-400">
              Air <span className="font-mono text-zinc-200">{state.weather.air_temp.toFixed(1)}°C</span>
            </span>
          ) : null}
          {state.weather.track_temp !== null ? (
            <span className="text-zinc-400">
              Track{' '}
              <span className="font-mono text-zinc-200">{state.weather.track_temp.toFixed(1)}°C</span>
            </span>
          ) : null}
          {state.weather.humidity !== null ? (
            <span className="text-zinc-400">
              Humidity{' '}
              <span className="font-mono text-zinc-200">{state.weather.humidity.toFixed(0)}%</span>
            </span>
          ) : null}
          {state.weather.wind_speed !== null ? (
            <span className="text-zinc-400">
              Wind{' '}
              <span className="font-mono text-zinc-200">{state.weather.wind_speed.toFixed(1)} m/s</span>
            </span>
          ) : null}
          {state.weather.rainfall ? (
            <span className="font-semibold text-blue-400">Rain</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function TowerRow({ row }: { row: LiveRow }) {
  const tyre = compoundInfo(row.compound)
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_5rem_3.5rem] items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-zinc-800/40 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_6rem_6rem_4rem]">
      <span className="text-right font-mono text-zinc-400">{row.position ?? '-'}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="h-5 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: teamColor(row.team_colour) }}
        />
        <span className="truncate font-semibold text-white">{row.abbreviation ?? row.driver_number}</span>
        {row.status ? (
          <span
            className={[
              'rounded px-1.5 text-[10px] font-bold uppercase',
              row.retired ? 'bg-zinc-700 text-zinc-300' : 'bg-amber-500/20 text-amber-400',
            ].join(' ')}
          >
            {row.status}
          </span>
        ) : null}
      </span>
      <span className="text-right font-mono text-xs text-zinc-300">{row.gap ?? '-'}</span>
      <span className="hidden text-right font-mono text-xs text-zinc-500 sm:block">
        {row.interval ?? '-'}
      </span>
      <span className="text-right font-mono text-xs text-zinc-400">
        {row.last_lap ?? row.best_lap ?? '-'}
      </span>
      <span className="flex items-center justify-end gap-1">
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold"
          style={{ color: tyre.color, borderColor: tyre.color }}
        >
          {tyre.letter}
        </span>
        <span className="w-5 text-right font-mono text-xs text-zinc-500">{row.tyre_age ?? '-'}</span>
      </span>
    </div>
  )
}

function Tower({ rows }: { rows: LiveRow[] }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-surface p-3">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_5rem_3.5rem] gap-2 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_6rem_6rem_4rem]">
        <span className="text-right">P</span>
        <span>Driver</span>
        <span className="text-right">Gap</span>
        <span className="hidden text-right sm:block">Int</span>
        <span className="text-right">Lap</span>
        <span className="text-right">Tyre</span>
      </div>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <TowerRow key={row.driver_number} row={row} />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ state }: { state: LiveState }) {
  const next = state.next_session
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Pill>
        <span className="h-1.5 w-1.5 rounded-full bg-f1-red" />
        Live
      </Pill>
      <h1 className="mt-5 text-3xl font-bold text-white">No live session right now</h1>
      <p className="mt-3 max-w-md text-zinc-400">
        When a session is running, live timing, tyre strategy and the timing tower will appear here
        in real time.
      </p>
      {next ? (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-surface px-6 py-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Next session</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {next.event_name} · {next.session_name}
          </p>
          <p className="mt-1 text-sm text-f1-red">{countdown(next.start_utc)}</p>
        </div>
      ) : null}
    </div>
  )
}

export default function Live() {
  const { data, error, loading } = useLive()

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-white">Could not load live timing</h1>
        <p className="mt-3 max-w-md text-zinc-400">Is the data server running?</p>
      </div>
    )
  }

  if (!data) {
    return null
  }

  if (data.source === 'none' || (data.rows.length === 0 && !data.live)) {
    return <EmptyState state={data} />
  }

  return (
    <div className="space-y-6">
      <Header state={data} />
      {data.rows.length > 0 ? (
        <Tower rows={data.rows} />
      ) : (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-surface py-16 text-zinc-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
          Connecting to the live timing feed...
        </div>
      )}
    </div>
  )
}
