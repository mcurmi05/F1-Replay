export interface ScheduleEvent {
  round: number | null
  country: string | null
  location: string | null
  event_name: string | null
  event_date: string | null
}

export interface SessionSummary {
  event_name: string | null
  country: string | null
  location: string | null
  session_name: string | null
  date: string | null
  drivers: string[]
}

export interface SessionResult {
  driver_number: string | null
  abbreviation: string | null
  full_name: string | null
  team_name: string | null
  team_colour: string | null
  position: number | null
  grid_position: number | null
  points: number | null
  status: string | null
  time: number | null
}

export interface SessionLap {
  driver_number: string | null
  lap_number: number | null
  lap_time: number | null
  sector_1: number | null
  sector_2: number | null
  sector_3: number | null
  compound: string | null
  tyre_life: number | null
  stint: number | null
}

export interface SessionData {
  summary: SessionSummary
  results: SessionResult[]
  laps: SessionLap[]
}

export interface TelemetryPoint {
  time: number | null
  distance: number | null
  speed: number | null
  throttle: number | null
  brake: boolean | null
  gear: number | null
  rpm: number | null
  drs: number | null
  x: number | null
  y: number | null
}

export interface ReplayDriver {
  number: string
  abbreviation: string | null
  full_name: string | null
  team_name: string | null
  team_colour: string | null
}

export interface ReplayData {
  step: number
  duration: number
  time: number[]
  track: { x: number[]; y: number[] }
  corners: { number: number | null; x: number | null; y: number | null }[]
  bounds: { min_x: number; max_x: number; min_y: number; max_y: number }
  drivers: ReplayDriver[]
  positions: Record<
    string,
    { x: (number | null)[]; y: (number | null)[]; speed?: (number | null)[] }
  >
}
