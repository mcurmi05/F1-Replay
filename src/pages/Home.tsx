import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRightIcon, ChevronDownIcon } from '../components/icons'

const isLiveNow = false

const featuredSession = {
  sessionKey: 9999,
  meeting: 'Monaco Grand Prix',
  sessionName: 'Race',
  circuit: 'Circuit de Monaco',
  date: 'May 26, 2024',
}

const recentSessions = [
  {
    sessionKey: 9998,
    meeting: 'Spanish Grand Prix',
    sessionName: 'Race',
    country: 'Spain',
    date: 'Jun 23, 2024',
  },
  {
    sessionKey: 9997,
    meeting: 'Canadian Grand Prix',
    sessionName: 'Qualifying',
    country: 'Canada',
    date: 'Jun 8, 2024',
  },
  {
    sessionKey: 9996,
    meeting: 'Austrian Grand Prix',
    sessionName: 'Race',
    country: 'Austria',
    date: 'Jun 30, 2024',
  },
]

const years = [2024, 2023]

const locations = [
  'Bahrain',
  'Saudi Arabia',
  'Australia',
  'Japan',
  'China',
  'Miami',
  'Monaco',
  'Spain',
  'Canada',
  'Austria',
  'Great Britain',
  'Hungary',
  'Belgium',
  'Netherlands',
  'Italy',
  'Singapore',
  'United States',
  'Mexico',
  'Brazil',
  'Las Vegas',
  'Qatar',
  'Abu Dhabi',
]

const sessionTypes = [
  'FP1',
  'FP2',
  'FP3',
  'Qualifying',
  'Sprint Qualifying',
  'Sprint Race',
  'Race',
]

function Dot() {
  return <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  options: Array<string | number>
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 pr-9 text-sm text-zinc-200 transition focus:border-f1-red focus:outline-none"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={String(option)}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      </div>
    </label>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [year, setYear] = useState('')
  const [location, setLocation] = useState('')
  const [session, setSession] = useState('')

  const canView = year !== '' && location !== '' && session !== ''

  function openHistoricalSession() {
    if (!canView) return
    const key = `${year}-${location}-${session}`
      .toLowerCase()
      .replace(/\s+/g, '-')
    navigate(`/replay/${encodeURIComponent(key)}`)
  }

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-surface to-[#0a0a0f] px-8 py-16 sm:px-12">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-f1-red/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-f1-red" />
            Telemetry dashboard
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Replay every moment of every F1 session.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-400">
            Live timing, track maps, tyre strategy and lap-by-lap telemetry, for
            the session happening right now or any session from the past.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/live"
              className="group inline-flex items-center gap-2 rounded-lg bg-f1-red px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {isLiveNow ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
              ) : null}
              {isLiveNow ? 'Watch live now' : 'Go to live'}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to={`/replay/${featuredSession.sessionKey}`}
              className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900/50 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Open latest replay
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          {isLiveNow ? 'Happening now' : 'Most recent session'}
        </h2>
        <Link
          to={`/replay/${featuredSession.sessionKey}`}
          className="group block rounded-2xl border border-zinc-800 bg-surface p-6 transition hover:border-zinc-700 hover:bg-surface-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                {isLiveNow ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-f1-red/15 px-2.5 py-1 text-xs font-semibold text-f1-red">
                    <span className="h-1.5 w-1.5 rounded-full bg-f1-red" />
                    LIVE
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    FINISHED
                  </span>
                )}
                <span className="text-xs text-zinc-500">{featuredSession.date}</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold text-white">
                {featuredSession.meeting}
              </h3>
              <div className="mt-1.5 flex items-center gap-2 text-sm text-zinc-400">
                <span>{featuredSession.sessionName}</span>
                <Dot />
                <span>{featuredSession.circuit}</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition group-hover:text-f1-red">
              Open replay
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Recent sessions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentSessions.map((item) => (
            <Link
              key={item.sessionKey}
              to={`/replay/${item.sessionKey}`}
              className="group rounded-xl border border-zinc-800 bg-surface p-5 transition hover:border-zinc-700 hover:bg-surface-2"
            >
              <p className="text-xs text-zinc-500">{item.date}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{item.meeting}</h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                <span>{item.sessionName}</span>
                <Dot />
                <span>{item.country}</span>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition group-hover:text-f1-red">
                Open replay
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Historical sessions
        </h2>
        <div className="rounded-2xl border border-zinc-800 bg-surface p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Year"
              value={year}
              placeholder="Select year"
              options={years}
              onChange={setYear}
            />
            <SelectField
              label="Location"
              value={location}
              placeholder="Select location"
              options={locations}
              onChange={setLocation}
            />
            <SelectField
              label="Session"
              value={session}
              placeholder="Select session"
              options={sessionTypes}
              onChange={setSession}
            />
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={openHistoricalSession}
              disabled={!canView}
              className="inline-flex items-center gap-2 rounded-lg bg-f1-red px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              View session
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
