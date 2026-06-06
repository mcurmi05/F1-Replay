import { useCallback, useEffect, useRef, useState } from 'react'

import type { LiveRawState } from '../../lib/api/types'
import { isRawStreamOpen, setRawStreamOpen, subscribeRawStream } from '../../lib/debugStream'

const POS_KEY = 'f1replay.debug.rawStream.pos'
const POLL_MS = 3000

interface Box {
  x: number
  y: number
  w: number
  h: number
}

function loadBox(): Box {
  const fallback: Box = { x: 24, y: 96, w: 460, h: 520 }
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export default function LiveRawStream() {
  const [box, setBox] = useState<Box>(loadBox)
  const [open, setOpen] = useState(isRawStreamOpen)
  const [data, setData] = useState<LiveRawState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [topic, setTopic] = useState<string>('__all__')
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => subscribeRawStream(setOpen), [])

  useEffect(() => {
    localStorage.setItem(POS_KEY, JSON.stringify(box))
  }, [box])

  useEffect(() => {
    if (!open) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function tick() {
      if (!pausedRef.current) {
        const controller = new AbortController()
        try {
          const res = await fetch('/api/live/raw', {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          })
          if (!res.ok) throw new Error(`Request failed (${res.status})`)
          const next = (await res.json()) as LiveRawState
          if (active) {
            setData(next)
            setError(null)
          }
        } catch (e: unknown) {
          if (active) setError(e instanceof Error ? e.message : String(e))
        }
      }
      if (active) timer = setTimeout(tick, POLL_MS)
    }

    tick()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [open])

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const origin = { x: box.x, y: box.y }
    const onMove = (ev: PointerEvent) => {
      setBox((b) => ({
        ...b,
        x: Math.max(0, origin.x + ev.clientX - startX),
        y: Math.max(0, origin.y + ev.clientY - startY),
      }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [box.x, box.y])

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const origin = { w: box.w, h: box.h }
    const onMove = (ev: PointerEvent) => {
      setBox((b) => ({
        ...b,
        w: Math.max(280, origin.w + ev.clientX - startX),
        h: Math.max(200, origin.h + ev.clientY - startY),
      }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [box.w, box.h])

  if (!open) return null

  const topics = data?.topics ?? {}
  const topicKeys = Object.keys(topics).sort()
  const shown = topic === '__all__' ? topics : { [topic]: topics[topic] }
  let body: string
  try {
    body = JSON.stringify(shown, null, 2)
  } catch {
    body = '[unserialisable payload]'
  }

  const statusLabel = error
    ? 'error'
    : !data
      ? 'loading'
      : data.available
        ? 'live'
        : data.source === 'none'
          ? 'no session'
          : data.source

  return (
    <div
      className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/95 shadow-2xl backdrop-blur"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <div
        onPointerDown={startDrag}
        className="flex cursor-move items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300"
      >
        <span className="tracking-[0.25em] text-zinc-500">:::</span>
        <span>SignalR Raw Stream</span>
        <span
          className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${
            statusLabel === 'live' ? 'bg-green-500/20 text-green-300' : 'bg-zinc-700/60 text-zinc-300'
          }`}
        >
          {statusLabel}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPaused((p) => !p)}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] hover:border-zinc-500"
          >
            {paused ? 'resume' : 'pause'}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => navigator.clipboard?.writeText(body)}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] hover:border-zinc-500"
          >
            copy
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setRawStreamOpen(false)}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 hover:border-zinc-500"
          >
            <svg viewBox="0 0 8 8" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth="1.5" fill="none">
              <path d="M1 1l6 6M7 1l-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-zinc-800 bg-zinc-900/60 px-2 py-1">
        <button
          type="button"
          onClick={() => setTopic('__all__')}
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            topic === '__all__' ? 'bg-f1-red/30 text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          all ({topicKeys.length})
        </button>
        {topicKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTopic(key)}
            className={`rounded px-1.5 py-0.5 text-[10px] ${
              topic === key ? 'bg-f1-red/30 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-[11px] leading-snug text-zinc-300">
        {error ? `Error: ${error}` : topicKeys.length === 0 ? 'Waiting for stream data...' : body}
      </pre>

      <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[10px] text-zinc-500">
        <span>{data?.updated_at ? new Date(data.updated_at).toLocaleTimeString() : '--'}</span>
        <span
          onPointerDown={startResize}
          className="h-3 w-3 cursor-se-resize select-none border-b-2 border-r-2 border-zinc-600 hover:border-zinc-300"
        />
      </div>
    </div>
  )
}
