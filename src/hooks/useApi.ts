import { useEffect, useRef, useState } from 'react'

import { api } from '../lib/api/client'
import type { ScheduleEvent, SessionData, TelemetryPoint } from '../lib/api/types'

export interface QueryState<T> {
  data: T | undefined
  error: Error | undefined
  loading: boolean
}

function useQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  enabled = true,
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: undefined,
    error: undefined,
    loading: enabled,
  })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (!enabled) {
      setState({ data: undefined, error: undefined, loading: false })
      return
    }
    const controller = new AbortController()
    setState({ data: undefined, error: undefined, loading: true })
    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, error: undefined, loading: false })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        setState({
          data: undefined,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        })
      })
    return () => controller.abort()
  }, [key, enabled])

  return state
}

export function useSchedule(year: number) {
  return useQuery<ScheduleEvent[]>(`schedule:${year}`, (signal) => api.schedule(year, signal))
}

export function useSession(year: number, event: string, sessionType: string, enabled = true) {
  return useQuery<SessionData>(
    `session:${year}:${event}:${sessionType}`,
    (signal) => api.session(year, event, sessionType, signal),
    enabled,
  )
}

export function useTelemetry(
  year: number,
  event: string,
  sessionType: string,
  driver: string,
  enabled = true,
) {
  return useQuery<TelemetryPoint[]>(
    `telemetry:${year}:${event}:${sessionType}:${driver}`,
    (signal) => api.telemetry(year, event, sessionType, driver, signal),
    enabled,
  )
}
