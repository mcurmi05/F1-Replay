import questionIcon from '../../assets/question.png'

function ElapsedHelp() {
  return (
    <span className="group relative ml-1 inline-flex">
      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded text-zinc-500 opacity-70 hover:bg-zinc-800 hover:opacity-100">
        <img src={questionIcon} alt="Help" className="h-3 w-3" />
      </span>
      <span className="pointer-events-none absolute left-0 top-6 z-40 hidden w-52 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-[11px] font-normal normal-case leading-snug text-zinc-300 shadow-xl group-hover:block">
        Time elapsed since the official start of the session.
      </span>
    </span>
  )
}

function formatRaceTime(seconds: number, hideHours: boolean): string {
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(seconds)
  const secs = Math.floor(abs % 60)
  if (hideHours) {
    const minutes = Math.floor(abs / 60)
    return `${sign}${minutes}:${String(secs).padStart(2, '0')}`
  }
  const hours = Math.floor(abs / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function ReplayClock({
  relative,
  lap,
  totalLaps,
  label,
  hideHours = false,
  elapsed = null,
  lapsPrimary = false,
}: {
  relative: number | null
  lap: number
  totalLaps: number | null
  label?: string | null
  hideHours?: boolean
  elapsed?: number | null
  lapsPrimary?: boolean
}) {
  const lapDisplay = relative !== null && relative < 0 ? '-' : lap
  const lapText = totalLaps ? `Lap ${lapDisplay}/${totalLaps}` : `Lap ${lapDisplay}`

  if (lapsPrimary) {
    return (
      <div className="relative flex min-h-8 items-center px-2 py-2">
        <span className="text-sm font-medium tabular-nums text-zinc-500">
          {elapsed != null ? formatRaceTime(elapsed, hideHours) : ''}
        </span>
        {elapsed != null ? <ElapsedHelp /> : null}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold tabular-nums text-white">
          {lapText}
        </span>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-8 items-center px-2 py-2">
      <span className="text-sm font-medium text-zinc-400">
        {label ? label : lapText}
      </span>
      <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-baseline gap-2 font-mono font-bold tabular-nums text-white">
        <span className="text-2xl">{relative === null ? '--:--' : formatRaceTime(relative, hideHours)}</span>
        {elapsed != null ? (
          <>
            <span className="text-base font-medium text-zinc-500">({formatRaceTime(elapsed, hideHours)})</span>
            <ElapsedHelp />
          </>
        ) : null}
      </span>
    </div>
  )
}
