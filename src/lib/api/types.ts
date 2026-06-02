export interface ScheduleEvent {
  round: number | null
  country: string | null
  location: string | null
  event_name: string | null
  event_date: string | null
  date_start: string | null
  date_end: string | null
  sessions: string[]
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

export interface LiveRow {
  position: number | null
  driver_number: string
  abbreviation: string | null
  full_name: string | null
  team_name: string | null
  team_colour: string | null
  gap: string | null
  interval: string | null
  last_lap: string | null
  best_lap: string | null
  compound: string | null
  tyre_age: number | null
  stint: number | null
  in_pit: boolean
  retired: boolean
  status: string | null
}

export interface LiveSession {
  event_name: string | null
  location: string | null
  country: string | null
  session_name: string | null
  session_type: string | null
  status: string | null
  track_status: { code: string | null; message: string }
  current_lap: number | null
  total_laps: number | null
  time_remaining: string | null
  started_at: string | null
}

export interface LiveWeather {
  air_temp: number | null
  track_temp: number | null
  humidity: number | null
  rainfall: boolean
  wind_speed: number | null
}

export interface LiveNextSession {
  event_name: string | null
  session_name: string | null
  start_utc: string
}

export interface LiveState {
  available: boolean
  live: boolean
  source: 'live' | 'historical' | 'none'
  session: LiveSession | null
  weather: LiveWeather | null
  rows: LiveRow[]
  next_session: LiveNextSession | null
  updated_at: string
}

export interface ReplayDriver {
  number: string
  abbreviation: string | null
  full_name: string | null
  team_name: string | null
  team_colour: string | null
}

export interface ReplayLap {
  lap: number | null
  position: number | null
  compound: string | null
  tyre_age: number | null
  stint: number | null
  pitted: boolean
  start: number | null
}

export interface ReplayData {
  available: boolean
  step: number
  duration: number
  race_start: number | null
  total_laps: number | null
  time: number[]
  track: { x: number[]; y: number[] }
  corners: { number: number | null; x: number | null; y: number | null }[]
  bounds: { min_x: number; max_x: number; min_y: number; max_y: number }
  drivers: ReplayDriver[]
  positions: Record<
    string,
    {
      x: (number | null)[]
      y: (number | null)[]
      speed?: (number | null)[]
      throttle?: (number | null)[]
      brake?: (number | null)[]
      gear?: (number | null)[]
    }
  >
  laps: Record<string, ReplayLap[]>
}
