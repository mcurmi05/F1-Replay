import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ArrowRightIcon, ChevronDownIcon } from '../components/icons'
import { useSchedule, useYears } from '../hooks/useApi'
import { api } from '../lib/api/client'
import type { ScheduleEvent } from '../lib/api/types'

type SessionStatus = 'available' | 'soon' | 'checking'

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

const SESSION_DURATION_MIN: Record<string, number> = {
  FP1: 60, FP2: 60, FP3: 60, Q: 75, SQ: 45, Sprint: 60, R: 130,
}
const AVAILABILITY_BUFFER_MIN = 15

// Schedule date_utc arrives as a naive UTC timestamp (no Z/offset), which the
// browser would otherwise parse as local time; normalize it to UTC.
function utcMs(value: string | null): number | null {
  if (!value) return null
  const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`
  const t = Date.parse(normalized)
  return Number.isFinite(t) ? t : null
}

// Estimated time a session's data could first be published: its start plus the
// session length plus a publish buffer.
function sessionEndMs(type: string, dateUtc: string | null, eventDate: string | null): number | null {
  const startMs = utcMs(dateUtc) ?? utcMs(eventDate)
  if (startMs === null) return null
  return startMs + ((SESSION_DURATION_MIN[type] ?? 90) + AVAILABILITY_BUFFER_MIN) * 60000
}

// A session has finished (by the clock) once past that estimated end time. This
// is a necessary-but-not-sufficient condition: the freshly finished session may
// still be awaiting its data, which is confirmed with a probe.
function sessionFinished(type: string, dateUtc: string | null, eventDate: string | null): boolean {
  const endMs = sessionEndMs(type, dateUtc, eventDate)
  return endMs === null || Date.now() >= endMs
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

function sessionsForEvent(sessions: ScheduleEvent['sessions']) {
  return sessions
    .map((info) => {
      const type = SESSION_TYPES.find((t) => t.names.includes(info.name))
      if (!type) return null
      return { ...type, date_local: info.date_local, date_utc: info.date_utc }
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
}

function finishedSessionsForEvent(event: ScheduleEvent) {
  return sessionsForEvent(event.sessions).filter((s) => sessionFinished(s.value, s.date_utc, event.event_date))
}

function formatSessionTime(dateLocal: string | null): string {
  if (!dateLocal) return ''
  const match = dateLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return ''
  const [, year, month, day, hour, minute] = match
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const monthName = d.toLocaleDateString('en-GB', { month: 'short' })
  const h = parseInt(hour)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${dayName} ${parseInt(day)} ${monthName} · ${h12}:${minute}${ampm}`
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
  const [session, setSession] = useState('')
  const [pickerEvent, setPickerEvent] = useState<ScheduleEvent | null>(null)

  const schedule = useSchedule(Number(year))
  const allRaces = (schedule.data ?? []).filter((event) => event.round !== null)
  const openableRaces = allRaces.filter((event) => finishedSessionsForEvent(event).length > 0)

  const eventOptions = openableRaces.map((event) => ({
    label: event.event_name ?? `Round ${event.round}`,
    value: String(event.round),
  }))

  const selectedEvent = allRaces.find((event) => String(event.round) === round)
  const sessionOptions = selectedEvent ? finishedSessionsForEvent(selectedEvent) : SESSION_TYPES

  // The single most recently finished session is the only one whose data might
  // not be published yet; everything older is assumed available. We probe just
  // that one against the F1 archive.
  const latestFinished = allRaces
    .flatMap((event) =>
      sessionsForEvent(event.sessions)
        .filter((s) => sessionFinished(s.value, s.date_utc, event.event_date))
        .map((s) => ({
          round: event.round,
          value: s.value,
          endMs: sessionEndMs(s.value, s.date_utc, event.event_date),
        })),
    )
    .reduce<{ round: number | null; value: string; endMs: number | null } | null>(
      (best, x) => (best === null || (x.endMs ?? 0) > (best.endMs ?? 0) ? x : best),
      null,
    )

  const [probe, setProbe] = useState<boolean | null>(null)
  const latestKey = latestFinished ? `${latestFinished.round}/${latestFinished.value}` : null
  useEffect(() => {
    if (!latestFinished || !year) {
      setProbe(null)
      return
    }
    setProbe(null)
    let cancelled = false
    api
      .sessionAvailable(Number(year), String(latestFinished.round), latestFinished.value)
      .then((r) => { if (!cancelled) setProbe(r.available) })
      .catch(() => { if (!cancelled) setProbe(true) })
    return () => { cancelled = true }
  }, [year, latestKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function statusFor(event: ScheduleEvent, value: string, dateUtc: string | null): SessionStatus {
    if (!sessionFinished(value, dateUtc, event.event_date)) return 'soon'
    if (latestFinished && event.round === latestFinished.round && value === latestFinished.value) {
      return probe === null ? 'checking' : probe ? 'available' : 'soon'
    }
    return 'available'
  }

  const selectedSession = selectedEvent
    ? sessionsForEvent(selectedEvent.sessions).find((s) => s.value === session)
    : undefined
  const selectedStatus =
    selectedEvent && selectedSession
      ? statusFor(selectedEvent, selectedSession.value, selectedSession.date_utc)
      : null

  const canView = year !== '' && round !== '' && session !== '' && selectedStatus === 'available'

  function openSession() {
    if (!canView) {
      return
    }
    navigate(`/replay/${year}/${round}/${session}`)
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-14 pb-10">
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Open a session
        </h2>
        <div className="rounded-2xl border border-zinc-800 bg-surface p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-4 sm:flex-row">
              <div className="sm:w-36">
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
              </div>
              <div className="flex-1">
                <SelectField
                  label="Grand Prix"
                  value={round}
                  placeholder={schedule.loading ? 'Loading...' : 'Select Grand Prix'}
                  options={eventOptions}
                  disabled={schedule.loading || eventOptions.length === 0}
                  onChange={(next) => {
                    setRound(next)
                    setSession('')
                  }}
                />
              </div>
              <div className="flex-1">
                <SelectField
                  label="Session"
                  value={session}
                  placeholder="Select session"
                  options={sessionOptions}
                  disabled={!round}
                  onChange={setSession}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={openSession}
              disabled={!canView}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-f1-red px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Open replay
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
          {selectedStatus === 'soon' ? (
            <p className="mt-4 text-sm text-zinc-500">Replay data for this session isn't available yet.</p>
          ) : selectedStatus === 'checking' ? (
            <p className="mt-4 text-sm text-zinc-500">Checking availability...</p>
          ) : null}
          {schedule.error ? (
            <p className="mt-4 text-sm text-f1-red">
              Could not load the schedule. Is the data server running?
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          {year} season
        </h2>
        {schedule.loading ? <p className="text-sm text-zinc-500">Loading schedule...</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allRaces.map((event) => {
            const upcoming = finishedSessionsForEvent(event).length === 0
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
          className="fixed left-0 top-0 z-50 flex h-screen w-screen items-center justify-center bg-black/60 px-6"
          onClick={() => setPickerEvent(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-surface p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs text-zinc-500">Round {pickerEvent.round}</p>
            <h2 className="mt-1 text-lg font-bold text-white">{pickerEvent.event_name}</h2>
            <p className="mt-3 text-sm text-zinc-400">Select a session to load.</p>
            <p className="mt-1 text-xs text-zinc-500">(times shown are track location time)</p>
            {(() => {
              const sessions = sessionsForEvent(pickerEvent.sessions).map((type) => ({
                ...type,
                status: statusFor(pickerEvent, type.value, type.date_utc),
                time: formatSessionTime(type.date_local),
              }))
              const ready = sessions.filter((s) => s.status === 'available')
              const soon = sessions.filter((s) => s.status !== 'available')
              return (
                <>
                  <div className="mt-4 grid gap-2">
                    {ready.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => navigate(`/replay/${year}/${pickerEvent.round}/${type.value}`)}
                        className="flex items-center justify-between rounded-lg border border-zinc-700 px-4 py-2.5 text-sm transition hover:border-f1-red hover:bg-zinc-800"
                      >
                        <span className="flex items-center gap-2 font-medium text-zinc-200">
                          {type.label}
                          {type.time && (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-500">{type.time}</span>
                            </>
                          )}
                        </span>
                        <ArrowRightIcon className="h-4 w-4 shrink-0 text-zinc-500" />
                      </button>
                    ))}
                  </div>
                  {soon.length > 0 ? (
                    <>
                      <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Available soon
                      </p>
                      <div className="grid gap-2">
                        {soon.map((type) => (
                          <div
                            key={type.value}
                            className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-2.5 text-sm opacity-60"
                          >
                            <span className="flex items-center gap-2 font-medium text-zinc-400">
                              {type.label}
                              {type.time && (
                                <>
                                  <span className="text-zinc-600">·</span>
                                  <span className="text-zinc-500">{type.time}</span>
                                </>
                              )}
                            </span>
                            {type.status === 'checking' ? (
                              <span className="shrink-0 text-xs font-medium text-zinc-500">Checking...</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              )
            })()}
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
