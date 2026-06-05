import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export default function FitScale({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const update = () => {
      const availW = outer.clientWidth
      const availH = outer.clientHeight
      // offset sizes are the pre-transform layout box, so the measurement is
      // stable regardless of the scale currently applied (no feedback loop).
      const natW = inner.offsetWidth
      const natH = inner.offsetHeight
      if (natW === 0 || natH === 0) return
      const next = Math.min(1, availW / natW, availH / natH)
      setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev))
    }

    const ro = new ResizeObserver(update)
    ro.observe(outer)
    ro.observe(inner)
    update()
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={outerRef} className="relative h-full w-full overflow-hidden">
      <div
        ref={innerRef}
        className={className}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `scale(${scale})`,
          transformOrigin: '50% 0',
        }}
      >
        {children}
      </div>
    </div>
  )
}
