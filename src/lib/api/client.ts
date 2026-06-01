import type { ScheduleEvent, SessionData, TelemetryPoint } from './types'

const BASE_URL = '/api'

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

export const api = {
  schedule: (year: number, signal?: AbortSignal) =>
    get<ScheduleEvent[]>(`/schedule/${year}`, signal),
  session: (year: number, event: string, sessionType: string, signal?: AbortSignal) =>
    get<SessionData>(
      `/session/${year}/${encodeURIComponent(event)}/${encodeURIComponent(sessionType)}`,
      signal,
    ),
  telemetry: (
    year: number,
    event: string,
    sessionType: string,
    driver: string,
    signal?: AbortSignal,
  ) =>
    get<TelemetryPoint[]>(
      `/session/${year}/${encodeURIComponent(event)}/${encodeURIComponent(sessionType)}/telemetry/${encodeURIComponent(driver)}`,
      signal,
    ),
}
