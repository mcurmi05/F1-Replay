// Shared open/close state for the debug SignalR raw-stream box so it can be
// toggled from the layout edit controls rather than its own floating button.
let open = false
const listeners = new Set<(value: boolean) => void>()

export function isRawStreamOpen(): boolean {
  return open
}

export function setRawStreamOpen(value: boolean): void {
  if (open === value) return
  open = value
  listeners.forEach((listener) => listener(value))
}

export function toggleRawStream(): void {
  setRawStreamOpen(!open)
}

export function subscribeRawStream(callback: (value: boolean) => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}
