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
  return (
    <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-surface px-6 py-3">
      <div className="w-28 text-sm font-medium text-zinc-400">
        {totalLaps ? `Lap ${lap} / ${totalLaps}` : `Lap ${lap}`}
      </div>
      <div className="font-mono text-3xl font-bold tabular-nums text-white">
        {relative === null ? '--:--' : formatRaceTime(relative)}
      </div>
      <div className="w-28" />
    </div>
  )
}
