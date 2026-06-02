import type {
  LiveState,
  ReplayData,
  ScheduleEvent,
  SessionData,
  TelemetryPoint,
} from './types'

const BASE_URL = '/api'

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (body && typeof body.detail === 'string' && body.detail) {
      return body.detail
    }
  } catch {
    /* response had no JSON body */
  }
  return `Request failed (${response.status})`
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  return (await response.json()) as T
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  return (await response.json()) as T
}

export const api = {
  years: (signal?: AbortSignal) => get<number[]>('/years', signal),
  getCache: (signal?: AbortSignal) =>
    get<{ dir: string | null; deleted?: boolean }>('/cache', signal),
  live: (signal?: AbortSignal) => get<LiveState>('/live', signal),
  setCache: (dir: string, deletePrevious = false) =>
    post<{ dir: string | null; previous: string | null; deleted: boolean }>('/cache', {
      dir,
      delete_previous: deletePrevious,
    }),
  schedule: (year: number, signal?: AbortSignal) =>
    get<ScheduleEvent[]>(`/schedule/${year}`, signal),
  sessionCached: (year: number, event: string, sessionType: string, signal?: AbortSignal) =>
    get<{ cached: boolean }>(
      `/session/${year}/${encodeURIComponent(event)}/${encodeURIComponent(sessionType)}/cached`,
      signal,
    ),
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
  replay: (year: number, event: string, sessionType: string, signal?: AbortSignal) =>
    get<ReplayData>(
      `/session/${year}/${encodeURIComponent(event)}/${encodeURIComponent(sessionType)}/replay`,
      signal,
    ),
}
