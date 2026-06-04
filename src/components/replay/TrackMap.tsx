import { useMemo, useState } from 'react'

import { teamColor } from '../../lib/format'
import type { ReplayData } from '../../lib/api/types'

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
  const { bounds, track, step, time } = replay
  const width = bounds.max_x - bounds.min_x
  const height = bounds.max_y - bounds.min_y
  const cx = (bounds.min_x + bounds.max_x) / 2
  const cy = (bounds.min_y + bounds.max_y) / 2
  const rad = (rotation * Math.PI) / 180
  const rotW = Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))
  const rotH = Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad))
  const pad = Math.max(rotW, rotH) * 0.06
  const viewBox = `${cx - rotW / 2 - pad} ${cy - rotH / 2 - pad} ${rotW + 2 * pad} ${rotH + 2 * pad}`
  const radius = Math.max(width, height) / 95
  const flipY = (y: number) => bounds.min_y + bounds.max_y - y

  const trackPoints = useMemo(
    () => track.x.map((x, i) => `${x},${bounds.min_y + bounds.max_y - track.y[i]}`).join(' '),
    [track, bounds],
  )

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

  return (
    <div className="relative h-full w-full">
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
      </g>
    </svg>
      {editMode ? <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1">
        <button
          type="button"
          onClick={() => setRotation(0)}
          title="Reset rotation"
          className="shrink-0 text-zinc-400 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
        <input
          type="range"
          min={0}
          max={359}
          value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
          title={`Rotate ${rotation}°`}
          className="h-1 w-28 cursor-pointer accent-f1-red"
        />
        <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-zinc-400">{rotation}°</span>
      </div> : null}
    </div>
  )
}
