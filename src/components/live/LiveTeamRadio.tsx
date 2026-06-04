import type { TeamRadioClip, LiveRow } from '../../lib/api/types'

function formatUtc(utc: string | null): string {
  if (!utc) return '-'
  try {
    const date = new Date(utc)
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '-'
  }
}

function getDriverInfo(driverNumber: string, rows: LiveRow[]): { abbr: string; color: string } {
  const row = rows.find((r) => r.driver_number === driverNumber)
  return {
    abbr: row?.abbreviation || driverNumber,
    color: row?.team_colour || '#71717a',
  }
}

export default function LiveTeamRadio({
  clips,
  drivers,
}: {
  clips: TeamRadioClip[]
  drivers: LiveRow[]
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Team Radio</p>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {clips.length === 0 ? (
          <p className="text-xs text-zinc-500">No radio transmissions</p>
        ) : (
          clips.map((clip, idx) => {
            const driver = getDriverInfo(clip.driver_number, drivers)
            return (
              <div key={idx} className="rounded border border-zinc-700 bg-zinc-900/30 p-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-5 w-8 rounded text-center text-xs font-bold text-white"
                    style={{ backgroundColor: driver.color }}
                  >
                    {driver.abbr}
                  </span>
                  <span className="text-xs text-zinc-500">{formatUtc(clip.utc)}</span>
                </div>
                <audio
                  controls
                  className="mt-1.5 h-6 w-full"
                  style={{
                    colorScheme: 'dark',
                  }}
                >
                  <source src={clip.url} type="audio/mp3" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
