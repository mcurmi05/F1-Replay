function formatRaceTime(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(seconds)
  const hours = Math.floor(abs / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  const secs = Math.floor(abs % 60)
  return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function ReplayClock({
  relative,
  lap,
  totalLaps,
}: {
  relative: number | null
  lap: number
  totalLaps: number | null
}) {
  const lapDisplay = relative !== null && relative < 0 ? '-' : lap
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2">
      <span className="text-sm font-medium text-zinc-400">
        {totalLaps ? `Lap ${lapDisplay} / ${totalLaps}` : `Lap ${lapDisplay}`}
      </span>
      <span className="font-mono text-2xl font-bold tabular-nums text-white">
        {relative === null ? '--:--' : formatRaceTime(relative)}
      </span>
    </div>
  )
}
