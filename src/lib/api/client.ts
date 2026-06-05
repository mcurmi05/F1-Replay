import type {
  LiveAuthStatus,
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

async function put<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  return (await response.json()) as T
}

async function del<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  return (await response.json()) as T
}

export interface SavedLayoutMeta {
  id: string
  name: string
}

export interface SavedLayoutFull extends SavedLayoutMeta {
  layout: unknown[]
  hiddenPanels: string[]
  timingColumns?: unknown[] | null
  cols?: number | null
}

export const api = {
  years: (signal?: AbortSignal) => get<number[]>('/years', signal),
  getCache: (signal?: AbortSignal) =>
    get<{ dir: string | null; deleted?: boolean }>('/cache', signal),
  live: (signal?: AbortSignal) => get<LiveState>('/live', signal),
  liveAuthStatus: (signal?: AbortSignal) => get<LiveAuthStatus>('/live/auth', signal),
  liveAuthLogin: () => post<{ url: string }>('/live/auth/login', {}),
  liveAuthLogout: () => post<LiveAuthStatus>('/live/auth/logout', {}),
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
  listLayouts: (category: string, signal?: AbortSignal) =>
    get<SavedLayoutMeta[]>(`/layouts/${encodeURIComponent(category)}`, signal),
  getLayout: (category: string, id: string, signal?: AbortSignal) =>
    get<SavedLayoutFull>(`/layouts/${encodeURIComponent(category)}/${encodeURIComponent(id)}`, signal),
  saveLayout: (category: string, name: string, layout: unknown[], hiddenPanels: string[], timingColumns?: unknown[] | null, cols?: number) =>
    post<SavedLayoutMeta>(`/layouts/${encodeURIComponent(category)}`, { name, layout, hidden_panels: hiddenPanels, timing_columns: timingColumns ?? null, cols: cols ?? null }),
  updateLayout: (
    category: string,
    id: string,
    name?: string,
    layout?: unknown[],
    hiddenPanels?: string[],
    timingColumns?: unknown[] | null,
    cols?: number,
  ) =>
    put<SavedLayoutMeta>(`/layouts/${encodeURIComponent(category)}/${encodeURIComponent(id)}`, {
      ...(name !== undefined ? { name } : {}),
      ...(layout !== undefined ? { layout } : {}),
      ...(hiddenPanels !== undefined ? { hidden_panels: hiddenPanels } : {}),
      ...(timingColumns !== undefined ? { timing_columns: timingColumns } : {}),
      ...(cols !== undefined ? { cols } : {}),
    }),
  deleteLayout: (category: string, id: string) =>
    del<{ ok: boolean }>(`/layouts/${encodeURIComponent(category)}/${encodeURIComponent(id)}`),
}
