import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ArrowRightIcon, ChevronDownIcon } from '../components/icons'
import { useSchedule, useYears } from '../hooks/useApi'
import type { ScheduleEvent } from '../lib/api/types'

const SESSION_TYPES = [
  { label: 'Practice 1', value: 'FP1', names: ['Practice 1'] },
  { label: 'Practice 2', value: 'FP2', names: ['Practice 2'] },
  { label: 'Practice 3', value: 'FP3', names: ['Practice 3'] },
  { label: 'Qualifying', value: 'Q', names: ['Qualifying'] },
  { label: 'Sprint Qualifying', value: 'SQ', names: ['Sprint Qualifying', 'Sprint Shootout'] },
  { label: 'Sprint', value: 'Sprint', names: ['Sprint'] },
  { label: 'Race', value: 'R', names: ['Race'] },
]

interface Option {
  label: string
  value: string
}

function isUpcoming(eventDate: string | null): boolean {
  if (!eventDate) {
    return false
  }
  return new Date(eventDate).getTime() > Date.now()
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) {
    return ''
  }
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (!start || !end) {
    return fmt((start ?? end)!)
  }
  const a = new Date(start)
  const b = new Date(end)
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} - ${fmt(end)}`
  }
  return `${fmt(start)} - ${fmt(end)}`
}

function sessionsForEvent(sessions: string[]) {
  return SESSION_TYPES.filter((type) => sessions.some((name) => type.names.includes(name)))
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  options: Option[]
  disabled?: boolean
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
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 pr-9 text-sm text-zinc-200 transition focus:border-f1-red focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
  const yearsQuery = useYears()
  const [year, setYear] = useState('')

  useEffect(() => {
    if (!year && yearsQuery.data && yearsQuery.data.length > 0) {
      setYear(String(yearsQuery.data[0]))
    }
  }, [yearsQuery.data, year])
  const [round, setRound] = useState('')
  const [session, setSession] = useState('R')
  const [pickerEvent, setPickerEvent] = useState<ScheduleEvent | null>(null)

  const schedule = useSchedule(Number(year))
  const allRaces = (schedule.data ?? []).filter((event) => event.round !== null)
  const pastRaces = allRaces.filter((event) => !isUpcoming(event.event_date))

  const eventOptions = pastRaces.map((event) => ({
    label: event.event_name ?? `Round ${event.round}`,
    value: String(event.round),
  }))

  const selectedEvent = allRaces.find((event) => String(event.round) === round)
  const sessionOptions = selectedEvent ? sessionsForEvent(selectedEvent.sessions) : SESSION_TYPES

  const canView = year !== '' && round !== '' && session !== ''

  function openSession() {
    if (!canView) {
      return
    }
    navigate(`/replay/${year}/${round}/${session}`)
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
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Open a session
        </h2>
        <div className="rounded-2xl border border-zinc-800 bg-surface p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Year"
              value={year}
              placeholder="Select year"
              options={(yearsQuery.data ?? []).map((value) => ({ label: String(value), value: String(value) }))}
              onChange={(next) => {
                setYear(next)
                setRound('')
              }}
            />
            <SelectField
              label="Grand Prix"
              value={round}
              placeholder={schedule.loading ? 'Loading...' : 'Select Grand Prix'}
              options={eventOptions}
              disabled={schedule.loading || eventOptions.length === 0}
              onChange={(next) => {
                setRound(next)
                setSession('R')
              }}
            />
            <SelectField
              label="Session"
              value={session}
              placeholder="Select session"
              options={sessionOptions}
              onChange={setSession}
            />
          </div>
          {schedule.error ? (
            <p className="mt-4 text-sm text-f1-red">
              Could not load the schedule. Is the data server running?
            </p>
          ) : null}
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={openSession}
              disabled={!canView}
              className="inline-flex items-center gap-2 rounded-lg bg-f1-red px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Open replay
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          {year} season
        </h2>
        {schedule.loading ? <p className="text-sm text-zinc-500">Loading schedule...</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allRaces.map((event) => {
            const upcoming = isUpcoming(event.event_date)
            const details = (
              <>
                <p className="text-xs text-zinc-500">
                  Round {event.round}
                  {formatDateRange(event.date_start, event.date_end)
                    ? ` · (${formatDateRange(event.date_start, event.date_end)})`
                    : ''}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{event.event_name}</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                  <span>{event.location}</span>
                  <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
                  <span>{event.country}</span>
                </div>
              </>
            )
            if (upcoming) {
              return (
                <div
                  key={event.round}
                  className="rounded-xl border border-zinc-800/60 bg-surface p-5 opacity-60"
                >
                  {details}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-600">
                    Upcoming
                  </span>
                </div>
              )
            }
            return (
              <button
                key={event.round}
                type="button"
                onClick={() => setPickerEvent(event)}
                className="group rounded-xl border border-zinc-800 bg-surface p-5 text-left transition hover:border-zinc-700 hover:bg-surface-2"
              >
                {details}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition group-hover:text-f1-red">
                  Open event
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {pickerEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setPickerEvent(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-surface p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs text-zinc-500">Round {pickerEvent.round}</p>
            <h2 className="mt-1 text-lg font-bold text-white">{pickerEvent.event_name}</h2>
            <p className="mt-3 text-sm text-zinc-400">Select a session to load.</p>
            <div className="mt-4 grid gap-2">
              {sessionsForEvent(pickerEvent.sessions).map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => navigate(`/replay/${year}/${pickerEvent.round}/${type.value}`)}
                  className="flex items-center justify-between rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-f1-red hover:bg-zinc-800"
                >
                  {type.label}
                  <ArrowRightIcon className="h-4 w-4 text-zinc-500" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPickerEvent(null)}
              className="mt-4 w-full rounded-lg px-5 py-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
