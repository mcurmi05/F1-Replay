import { useEffect, useMemo, useRef, useState } from 'react'

import { teamColor } from '../../lib/format'
import type { ReplayData } from '../../lib/api/types'
import { useReplayLayout } from '../../hooks/useReplayLayout'

function lerp(values: (number | null)[], i0: number, i1: number, frac: number): number | null {
  const a = values[i0]
  if (a === null || a === undefined) {
    return null
  }
  const b = values[i1]
  if (b === null || b === undefined) {
    return a
  }
  return a + (b - a) * frac
}

export default function TrackMap({
  replay,
  currentTime,
  selected,
  onSelect,
  editMode = false,
}: {
  replay: ReplayData
  currentTime: number
  selected: string | null
  onSelect: (driver: string) => void
  editMode?: boolean
}) {
  const [rotation, setRotation] = useState(0)
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 })
  const [showZoom, setShowZoom] = useState(false)
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerAspect, setContainerAspect] = useState(1)
  const { setTrackRotation } = useReplayLayout()
  const vWRef = useRef(0)
  const vHRef = useRef(0)

  useEffect(() => {
    setTrackRotation(rotation)
  }, [rotation, setTrackRotation])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (height > 0) setContainerAspect(width / height)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / rect.width
      const fy = (e.clientY - rect.top) / rect.height
      const vW = vWRef.current
      const vH = vHRef.current
      setShowZoom(true)
      if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current)
      zoomTimerRef.current = setTimeout(() => setShowZoom(false), 2000)
      setView((prev) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
        const nextZoom = Math.max(1, Math.min(20, prev.zoom * factor))
        if (nextZoom === 1) return { zoom: 1, panX: 0, panY: 0 }
        const dPanX = vW * (fx - 0.5) * (1 / prev.zoom - 1 / nextZoom)
        const dPanY = vH * (fy - 0.5) * (1 / prev.zoom - 1 / nextZoom)
        return { zoom: nextZoom, panX: prev.panX + dPanX, panY: prev.panY + dPanY }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const { bounds, track, corners, step, time } = replay
  const width = bounds.max_x - bounds.min_x
  const height = bounds.max_y - bounds.min_y
  const cx = (bounds.min_x + bounds.max_x) / 2
  const cy = (bounds.min_y + bounds.max_y) / 2
  const rad = (rotation * Math.PI) / 180
  const rotW = Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))
  const rotH = Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad))
  const pad = Math.max(rotW, rotH) * 0.02
  const tightW = rotW + 2 * pad
  const tightH = rotH + 2 * pad
  const vW = tightW / tightH > containerAspect ? tightW : tightH * containerAspect
  const vH = tightW / tightH > containerAspect ? tightW / containerAspect : tightH
  vWRef.current = vW
  vHRef.current = vH

  const { zoom, panX, panY } = view
  const vwZ = vW / zoom
  const vhZ = vH / zoom
  const viewBox = `${cx + panX - vwZ / 2} ${cy + panY - vhZ / 2} ${vwZ} ${vhZ}`
  const radius = Math.max(width, height) / 95
  const flipY = (y: number) => bounds.min_y + bounds.max_y - y

  const trackPoints = useMemo(
    () => track.x.map((x, i) => `${x},${bounds.min_y + bounds.max_y - track.y[i]}`).join(' '),
    [track, bounds],
  )

  const validCorners = useMemo(() => {
    const fy0 = bounds.min_y + bounds.max_y
    return corners.flatMap((c) => {
      if (c.x === null || c.y === null || c.number === null) return []
      return [{ label: c.letter ? `${c.number}${c.letter}` : String(c.number), fx: c.x, fy: fy0 - c.y }]
    })
  }, [corners, bounds])

  const startLine = useMemo(() => {
    if (track.x.length < 2) return null
    const fy0 = bounds.min_y + bounds.max_y
    const r = Math.max(bounds.max_x - bounds.min_x, bounds.max_y - bounds.min_y) / 95
    const sx = track.x[0]
    const sy = fy0 - track.y[0]
    const tdx = track.x[1] - track.x[0]
    const tdy = (fy0 - track.y[1]) - sy
    const tLen = Math.sqrt(tdx * tdx + tdy * tdy) || 1
    const pnx = -tdy / tLen
    const pny = tdx / tLen
    const lineLen = r * 2.6
    return {
      x1: sx + pnx * lineLen, y1: sy + pny * lineLen,
      x2: sx - pnx * lineLen, y2: sy - pny * lineLen,
    }
  }, [track, bounds])

  const sectorLines = useMemo(() => {
    const markers = track.sector_markers
    if (!markers || markers.length === 0 || track.x.length < 2) return []
    const fy0 = bounds.min_y + bounds.max_y
    const r = Math.max(bounds.max_x - bounds.min_x, bounds.max_y - bounds.min_y) / 95
    const lineLen = r * 1.6
    return markers.flatMap((m) => {
      let nearest = 0
      let bestDist = Infinity
      for (let i = 0; i < track.x.length; i += 1) {
        const dx = track.x[i] - m.x
        const dy = track.y[i] - m.y
        const d = dx * dx + dy * dy
        if (d < bestDist) {
          bestDist = d
          nearest = i
        }
      }
      const j = nearest + 1 < track.x.length ? nearest + 1 : nearest - 1
      if (j < 0) return []
      const sx = track.x[nearest]
      const sy = fy0 - track.y[nearest]
      const tdx = track.x[j] - sx
      const tdy = (fy0 - track.y[j]) - sy
      const tLen = Math.sqrt(tdx * tdx + tdy * tdy) || 1
      const pnx = -tdy / tLen
      const pny = tdx / tLen
      return [{
        x1: sx + pnx * lineLen, y1: sy + pny * lineLen,
        x2: sx - pnx * lineLen, y2: sy - pny * lineLen,
      }]
    })
  }, [track, bounds])

  const length = time.length
  const ratio = step > 0 ? currentTime / step : 0
  const base = Math.floor(ratio)
  const i0 = Math.max(0, Math.min(base, length - 1))
  const i1 = Math.min(i0 + 1, length - 1)
  const frac = Math.max(0, Math.min(ratio - base, 1))

  const selectedDriver = selected ? replay.drivers.find((d) => d.number === selected) : null
  const selectedPath = selected ? replay.positions[selected] : undefined
  const selX = selectedPath ? lerp(selectedPath.x, i0, i1, frac) : null
  const selY = selectedPath ? lerp(selectedPath.y, i0, i1, frac) : null

  const zoomPct = Math.round(zoom * 100)

  return (
    <div ref={containerRef} className="relative h-full w-full">
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full pointer-events-none" style={{ overflowAnchor: 'none' }}>
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
      <polyline
        points={trackPoints}
        fill="none"
        stroke="#3f3f46"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {sectorLines.map((s, i) => (
        <line
          key={`sector-${i}`}
          x1={s.x1} y1={s.y1}
          x2={s.x2} y2={s.y2}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={radius * 0.18}
          strokeLinecap="round"
          className="pointer-events-none"
        />
      ))}
      {startLine ? (
        <line
          x1={startLine.x1} y1={startLine.y1}
          x2={startLine.x2} y2={startLine.y2}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={radius * 0.4}
          strokeLinecap="round"
          className="pointer-events-none"
        />
      ) : null}
      {replay.drivers.map((driver) => {
        const path = replay.positions[driver.number]
        if (!path) {
          return null
        }
        const x = lerp(path.x, i0, i1, frac)
        const y = lerp(path.y, i0, i1, frac)
        if (x === null || y === null) {
          return null
        }
        const isSelected = selected === driver.number
        return (
          <circle
            key={driver.number}
            cx={x}
            cy={flipY(y)}
            r={isSelected ? radius * 1.6 : radius}
            fill={teamColor(driver.team_colour)}
            stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.45)'}
            strokeWidth={isSelected ? radius * 0.45 : radius * 0.18}
            className="cursor-pointer pointer-events-auto"
            onClick={() => onSelect(driver.number)}
          />
        )
      })}
      {validCorners.map((c) => (
        <g key={c.label} className="pointer-events-none">
          <circle
            cx={c.fx} cy={c.fy}
            r={radius * 1.1}
            fill="rgba(20,20,28,0.75)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={radius * 0.1}
          />
          <text
            x={c.fx}
            y={c.fy}
            transform={`rotate(${-rotation} ${c.fx} ${c.fy})`}
            fontSize={radius * 0.95}
            dominantBaseline="central"
            textAnchor="middle"
            fill="rgba(255,255,255,0.85)"
            className="font-semibold"
          >
            {c.label}
          </text>
        </g>
      ))}
      {selectedDriver && selX !== null && selY !== null ? (
        <text
          x={selX + radius * 1.8}
          y={flipY(selY) - radius}
          transform={`rotate(${-rotation} ${selX + radius * 1.8} ${flipY(selY) - radius})`}
          fontSize={radius * 2.6}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={radius * 0.12}
          style={{ paintOrder: 'stroke' }}
          className="font-semibold pointer-events-none"
        >
          {selectedDriver.abbreviation ?? selectedDriver.number}
        </text>
      ) : null}
      {editMode ? (
        <rect
          x={bounds.min_x}
          y={flipY(bounds.max_y)}
          width={width}
          height={height}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={radius * 0.25}
          strokeDasharray={`${radius * 2} ${radius}`}
          className="pointer-events-none"
        />
      ) : null}
      </g>
    </svg>
    {showZoom && zoomPct !== 100 ? (
      <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2 font-mono text-[10px] tabular-nums text-zinc-400">
        {zoomPct}%
      </div>
    ) : null}
    {editMode ? (
      <div onMouseDown={(e) => e.stopPropagation()} className="absolute bottom-2 left-2 right-2 z-10 flex flex-col gap-1">
        {showZoom && zoomPct !== 100 ? (
          <div className="flex justify-center">
            <span className="font-mono text-[10px] tabular-nums text-zinc-500">{zoomPct}%</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1">
          <input
            type="range"
            min={0}
            max={359}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            title={`Rotate ${rotation}°`}
            className="h-1 flex-1 cursor-pointer accent-f1-red"
          />
          <input
            type="number"
            min={0}
            max={359}
            value={rotation}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value))
              if (!Number.isNaN(v)) setRotation(((v % 360) + 360) % 360)
            }}
            className="w-10 shrink-0 bg-transparent text-right font-mono text-[10px] tabular-nums text-zinc-400 focus:text-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="shrink-0 font-mono text-[10px] text-zinc-400">°</span>
        </div>
      </div>
    ) : null}
    </div>
  )
}
