import { formatSigned } from '../../lib/format'

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
        {relative === null ? '--:--' : formatSigned(relative)}
      </div>
      <div className="w-28" />
    </div>
  )
}
