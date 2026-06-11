import { useEffect, useState } from 'react'

// Portrait phones (narrow) or phones held in landscape (wide but short, with a
// touch pointer). Both get the stacked mobile board rather than the draggable
// desktop grid, which needs height the landscape phone does not have.
const QUERY =
  '(max-width: 767px), (max-height: 600px) and (orientation: landscape) and (pointer: coarse)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

function computeColumns(): number {
  if (typeof window === 'undefined') return 1
  const w = window.innerWidth
  const h = window.innerHeight
  // Only split into columns in landscape, where there is width to spare; in
  // portrait a single column keeps each panel readably wide.
  if (w <= h) return 1
  if (w >= 1024) return 3
  if (w >= 640) return 2
  return 1
}

// Number of columns the mobile board should use. Tracks orientation and width
// so a phone rotated to landscape packs panels side by side instead of one tall
// scroll.
export function useMobileColumns(): number {
  const [columns, setColumns] = useState(computeColumns)

  useEffect(() => {
    const onResize = () => setColumns(computeColumns())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  return columns
}
