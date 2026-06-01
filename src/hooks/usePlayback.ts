import { useCallback, useEffect, useRef, useState } from 'react'

export interface Playback {
  currentTime: number
  playing: boolean
  speed: number
  setSpeed: (speed: number) => void
  toggle: () => void
  seek: (time: number) => void
}

export function usePlayback(duration: number): Playback {
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const positionRef = useRef(0)

  useEffect(() => {
    if (!playing) {
      return
    }
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = (now - last) / 1000
      last = now
      let next = positionRef.current + delta * speed
      if (next >= duration) {
        next = duration
        positionRef.current = next
        setCurrentTime(next)
        setPlaying(false)
        return
      }
      positionRef.current = next
      setCurrentTime(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, duration])

  const seek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, duration))
      positionRef.current = clamped
      setCurrentTime(clamped)
    },
    [duration],
  )

  const toggle = useCallback(() => setPlaying((value) => !value), [])

  return { currentTime, playing, speed, setSpeed, toggle, seek }
}
