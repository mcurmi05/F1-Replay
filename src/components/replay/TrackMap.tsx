import { useMemo } from 'react'

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
}: {
  replay: ReplayData
  currentTime: number
  selected: string | null
  onSelect: (driver: string) => void
}) {
  const { bounds, track, step, time } = replay
  const width = bounds.max_x - bounds.min_x
  const height = bounds.max_y - bounds.min_y
  const pad = Math.max(width, height) * 0.06
  const viewBox = `${bounds.min_x - pad} ${bounds.min_y - pad} ${width + 2 * pad} ${height + 2 * pad}`
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
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
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
            className="cursor-pointer"
            onClick={() => onSelect(driver.number)}
          />
        )
      })}
      {selectedDriver && selX !== null && selY !== null ? (
        <text
          x={selX + radius * 1.8}
          y={flipY(selY) - radius}
          fontSize={radius * 2.6}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={radius * 0.12}
          style={{ paintOrder: 'stroke' }}
          className="font-semibold"
        >
          {selectedDriver.abbreviation ?? selectedDriver.number}
        </text>
      ) : null}
    </svg>
  )
}
