export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return '-'
  }
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '0:00'
  }
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

export function formatSigned(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+'
  const abs = Math.abs(seconds)
  const minutes = Math.floor(abs / 60)
  const rest = Math.floor(abs % 60)
  return `${sign}${minutes}:${String(rest).padStart(2, '0')}`
}

export function teamColor(value: string | null | undefined): string {
  if (!value) {
    return '#71717a'
  }
  return value.startsWith('#') ? value : `#${value}`
}
