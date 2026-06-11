import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { LAYOUT_STORAGE_KEY } from './PanelGrid'
import { usePersistedLayout } from '../../hooks/usePersistedLayout'
import { useReplayLayout } from '../../hooks/useReplayLayout'
import type { PanelDef } from '../../hooks/useReplayLayout'
import type { LayoutCategory, SessionDefault } from '../../lib/defaultLayouts'

const MOBILE_ORDER_KEY = 'f1replay.mobileOrder.v1'

function loadMobileOrder(scopeKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${MOBILE_ORDER_KEY}.${scopeKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

const MOBILE_HEIGHTS_KEY = 'f1replay.mobileHeights.v1'
const MOBILE_MIN_PANEL_H = 96

function loadMobileHeights(scopeKey: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${MOBILE_HEIGHTS_KEY}.${scopeKey}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

const MOBILE_COLS_KEY = 'f1replay.mobileCols.v1'

function loadMobileCols(scopeKey: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${MOBILE_COLS_KEY}.${scopeKey}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function MobileEditControls({
  onUp,
  onDown,
  onLeft,
  onRight,
  onHide,
  canUp,
  canDown,
  canLeft,
  canRight,
}: {
  onUp: () => void
  onDown: () => void
  onLeft?: () => void
  onRight?: () => void
  onHide: () => void
  canUp: boolean
  canDown: boolean
  canLeft?: boolean
  canRight?: boolean
}) {
  return (
    <div className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/95 p-0.5 shadow-lg">
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        title="Move up"
      >
        <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor"><path d="M5 2l4 5H1z" /></svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        title="Move down"
      >
        <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor"><path d="M5 8L1 3h8z" /></svg>
      </button>
      {onLeft ? (
        <button
          type="button"
          onClick={onLeft}
          disabled={!canLeft}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
          title="Move left"
        >
          <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor"><path d="M7 1L2 5l5 4z" /></svg>
        </button>
      ) : null}
      {onRight ? (
        <button
          type="button"
          onClick={onRight}
          disabled={!canRight}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
          title="Move right"
        >
          <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor"><path d="M3 1l5 4-5 4z" /></svg>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onHide}
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-f1-red/20 hover:text-f1-red"
        title="Hide panel"
      >
        <svg viewBox="0 0 8 8" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth="1.5" fill="none">
          <path d="M1 1l6 6M7 1l-6 6" />
        </svg>
      </button>
    </div>
  )
}

// Drag handle pinned to the bottom of a mobile panel. Dragging changes the
// panel height (width is fixed by the column); onResize fires live during the
// drag, onCommit once it ends so the height is only persisted on release.
function MobileResizeHandle({
  onResize,
  onCommit,
}: {
  onResize: (height: number) => void
  onCommit: () => void
}) {
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const wrapper = e.currentTarget.parentElement
    if (!wrapper) return
    const startY = e.clientY
    const startH = wrapper.getBoundingClientRect().height
    const move = (ev: PointerEvent) => {
      onResize(Math.max(MOBILE_MIN_PANEL_H, Math.round(startH + ev.clientY - startY)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onCommit()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div
      onPointerDown={onPointerDown}
      style={{ touchAction: 'none' }}
      className="absolute inset-x-0 bottom-0 z-30 flex h-6 cursor-ns-resize items-end justify-center pb-1"
      title="Drag to resize"
    >
      <div className="h-1.5 w-12 rounded-full bg-f1-red/70" />
    </div>
  )
}

// Stacked mobile rendering of a board (live or replay): a scrolling single
// column in portrait, explicit side-by-side columns in landscape. It registers
// with the layout context (active, panel defs, scope, layout accessors) so the
// burger menu behaves as on desktop; editing here means hide/show, reorder,
// move between columns and resize rather than free drag/resize.
export default function MobileStack({
  scopeKey,
  category,
  sessionDefault,
  panelDefs,
  panels,
  header,
  heightFor,
  columns,
  defaultOrder,
}: {
  scopeKey: string
  category: LayoutCategory
  sessionDefault: SessionDefault
  panelDefs: PanelDef[]
  panels: Record<string, ReactNode>
  header?: ReactNode
  heightFor: (id: string) => { className?: string; style?: CSSProperties }
  columns: number
  defaultOrder: string[]
}) {
  const {
    setActive, setEditMode, registerReset, registerPanelDefs, applyScope,
    registerShowPanel, registerLayoutAccessors,
    editMode, hiddenPanels, hidePanel, handleShowPanel,
  } = useReplayLayout()

  const { layout, setLayout, reset } = usePersistedLayout(`${LAYOUT_STORAGE_KEY}.${scopeKey}`, sessionDefault.layout)
  const layoutRef = useRef(layout)
  useEffect(() => { layoutRef.current = layout }, [layout])

  // Keyed by scopeKey at the call site, so this remounts (and the initializer
  // re-reads the saved order) when the session/category changes.
  const [order, setOrderState] = useState<string[]>(() => loadMobileOrder(scopeKey) ?? defaultOrder)
  const setOrder = useCallback((next: string[]) => {
    setOrderState(next)
    try {
      localStorage.setItem(`${MOBILE_ORDER_KEY}.${scopeKey}`, JSON.stringify(next))
    } catch {
      return
    }
  }, [scopeKey])

  // Per-panel height overrides set by dragging the resize handle. Updated live
  // during a drag, persisted on release.
  const [heights, setHeights] = useState<Record<string, number>>(() => loadMobileHeights(scopeKey))
  const heightsRef = useRef(heights)
  useEffect(() => { heightsRef.current = heights }, [heights])
  const resizePanel = useCallback((id: string, h: number) => {
    setHeights((prev) => ({ ...prev, [id]: h }))
  }, [])
  const persistHeights = useCallback(() => {
    try {
      localStorage.setItem(`${MOBILE_HEIGHTS_KEY}.${scopeKey}`, JSON.stringify(heightsRef.current))
    } catch {
      return
    }
  }, [scopeKey])
  const resetHeights = useCallback(() => {
    setHeights({})
    try {
      localStorage.removeItem(`${MOBILE_HEIGHTS_KEY}.${scopeKey}`)
    } catch {
      return
    }
  }, [scopeKey])

  // Per-panel column assignment for the landscape multi-column layout. Unset
  // panels fall back to a round-robin spread by their position in the order.
  const [colOf, setColOfState] = useState<Record<string, number>>(() => loadMobileCols(scopeKey))
  const setColOf = useCallback((next: Record<string, number>) => {
    setColOfState(next)
    try {
      localStorage.setItem(`${MOBILE_COLS_KEY}.${scopeKey}`, JSON.stringify(next))
    } catch {
      return
    }
  }, [scopeKey])
  const resetCols = useCallback(() => {
    setColOfState({})
    try {
      localStorage.removeItem(`${MOBILE_COLS_KEY}.${scopeKey}`)
    } catch {
      return
    }
  }, [scopeKey])

  useEffect(() => {
    applyScope(scopeKey, sessionDefault, category)
  }, [scopeKey, sessionDefault, category, applyScope])

  useEffect(() => {
    setActive(true)
    registerReset(() => { reset(); setOrder(defaultOrder); resetHeights(); resetCols() })
    registerShowPanel(null)
    registerLayoutAccessors(() => layoutRef.current, (l) => setLayout(l))
    return () => {
      setActive(false)
      setEditMode(false)
      registerReset(null)
      registerShowPanel(null)
      registerLayoutAccessors(null, null)
    }
  }, [setActive, setEditMode, registerReset, registerShowPanel, registerLayoutAccessors, reset, setOrder, setLayout, resetHeights, resetCols, defaultOrder])

  useEffect(() => {
    registerPanelDefs(panelDefs)
    return () => registerPanelDefs([])
  }, [registerPanelDefs, panelDefs])

  // The mobile order is independent of the desktop grid; panels present in the
  // board but missing from a saved order (e.g. newly added) are appended.
  const present = panelDefs.map((p) => p.id).filter((id) => panels[id] !== undefined)
  const presentSet = new Set(present)
  const fullOrder = [
    ...order.filter((id) => presentSet.has(id)),
    ...present.filter((id) => !order.includes(id)),
  ]
  const visibleOrder = fullOrder.filter((id) => !hiddenPanels.has(id))
  const labelById = Object.fromEntries(panelDefs.map((p) => [p.id, p.label]))
  const hiddenDefs = panelDefs.filter((p) => hiddenPanels.has(p.id) && panels[p.id] !== undefined)

  const multi = columns > 1

  // Column a panel sits in: an explicit drag assignment, else a round-robin
  // spread by its stable position in the order. Clamped to the live count so
  // assignments survive a drop from 3 columns to 2.
  const colIndexOf = (id: string): number => {
    const explicit = colOf[id]
    const c = explicit === undefined ? fullOrder.indexOf(id) % columns : explicit
    return Math.min(columns - 1, Math.max(0, c))
  }

  // Visible panels grouped into columns, each keeping the global vertical order.
  const buckets: string[][] = Array.from({ length: columns }, () => [])
  for (const id of visibleOrder) buckets[colIndexOf(id)].push(id)

  // Up/down swaps a panel with its neighbour in the same column.
  function moveVertical(id: string, dir: -1 | 1) {
    const col = buckets[colIndexOf(id)]
    const target = col.indexOf(id) + dir
    if (target < 0 || target >= col.length) return
    const next = [...fullOrder]
    const ia = next.indexOf(id)
    const ib = next.indexOf(col[target])
    ;[next[ia], next[ib]] = [next[ib], next[ia]]
    setOrder(next)
  }

  // Left/right reassigns the panel to the neighbouring column.
  function moveHorizontal(id: string, dir: -1 | 1) {
    const target = colIndexOf(id) + dir
    if (target < 0 || target >= columns) return
    setColOf({ ...colOf, [id]: target })
  }

  const renderPanel = (id: string) => {
    const base = heightFor(id)
    const override = heights[id]
    // A drag override replaces the default height entirely (and its
    // aspect/height className); width still comes from the column.
    const effClassName = override !== undefined ? '' : base.className ?? ''
    const effStyle: CSSProperties = override !== undefined ? { height: override } : base.style ?? {}
    const col = colIndexOf(id)
    const bucket = buckets[col]
    const bi = bucket.indexOf(id)
    return (
      <div key={id} className={`relative ${effClassName}`} style={effStyle}>
        {editMode ? (
          <MobileEditControls
            onUp={() => moveVertical(id, -1)}
            onDown={() => moveVertical(id, 1)}
            onLeft={multi ? () => moveHorizontal(id, -1) : undefined}
            onRight={multi ? () => moveHorizontal(id, 1) : undefined}
            onHide={() => hidePanel(id)}
            canUp={bi > 0}
            canDown={bi < bucket.length - 1}
            canLeft={col > 0}
            canRight={col < columns - 1}
          />
        ) : null}
        {panels[id]}
        {editMode ? (
          <MobileResizeHandle onResize={(h) => resizePanel(id, h)} onCommit={persistHeights} />
        ) : null}
      </div>
    )
  }

  // In landscape the board splits into explicit side-by-side columns; each is an
  // independent vertical stack, so panels of differing heights leave no row gaps
  // and can be moved between columns. Portrait keeps the centred single column.
  return (
    <div className={multi ? 'w-full pb-8' : 'mx-auto w-full max-w-xl pb-8'}>
      {header ? <div className="mb-3">{header}</div> : null}
      {multi ? (
        <div className="flex items-start gap-3">
          {buckets.map((bucket, c) => (
            <div key={c} className="flex min-w-0 flex-1 flex-col gap-3">
              {bucket.map(renderPanel)}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">{visibleOrder.map(renderPanel)}</div>
      )}
      {editMode && hiddenDefs.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-zinc-700 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Hidden panels</p>
          <div className="flex flex-wrap gap-2">
            {hiddenDefs.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleShowPanel(p.id)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-f1-red/50 hover:text-white"
              >
                <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 shrink-0" stroke="currentColor" strokeWidth="1.5" fill="none">
                  <path d="M4 1v6M1 4h6" />
                </svg>
                {labelById[p.id] ?? p.id}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
