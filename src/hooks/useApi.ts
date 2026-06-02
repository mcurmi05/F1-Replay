import { useEffect, useRef, useState } from 'react'

import { api } from '../lib/api/client'
import type {
  LiveState,
  ReplayData,
  ScheduleEvent,
  SessionData,
  TelemetryPoint,
} from '../lib/api/types'

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

export function useYears() {
  return useQuery<number[]>('years', (signal) => api.years(signal))
}

export function useLive(intervalMs = 4000) {
  const [state, setState] = useState<QueryState<LiveState>>({
    data: undefined,
    error: undefined,
    loading: true,
  })

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function tick() {
      const controller = new AbortController()
      try {
        const data = await api.live(controller.signal)
        if (active) {
          setState({ data, error: undefined, loading: false })
        }
      } catch (error: unknown) {
        if (active) {
          setState((previous) => ({
            data: previous.data,
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
          }))
        }
      }
      if (active) {
        const delay = document.hidden ? intervalMs * 4 : intervalMs
        timer = setTimeout(tick, delay)
      }
    }

    tick()
    return () => {
      active = false
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [intervalMs])

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

export function useReplay(year: number, event: string, sessionType: string, enabled = true) {
  return useQuery<ReplayData>(
    `replay:${year}:${event}:${sessionType}`,
    (signal) => api.replay(year, event, sessionType, signal),
    enabled,
  )
}
