import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactGridLayout, { noCompactor } from 'react-grid-layout'
import type { Layout, ResizeHandleAxis } from 'react-grid-layout'

import { usePersistedLayout } from '../../hooks/usePersistedLayout'
import { useReplayLayout } from '../../hooks/useReplayLayout'
import type { PanelDef } from '../../hooks/useReplayLayout'
import { BASE_COLS, COLS, FINE } from '../../lib/layoutGrid'
import type { SessionDefault, LayoutCategory } from '../../lib/defaultLayouts'

const LAYOUT_STORAGE_KEY = 'f1replay.replayLayout.v10'
const GRID_MARGIN = 8
const HEADER_H = 64
const PAD_TOP = 16
const PAD_H = 32
const FREE_COMPACTOR = { ...noCompactor, preventCollision: true }
const RESIZE_HANDLES: ResizeHandleAxis[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const RESIZE_EDGE = 8
const RESIZE_CORNER = 14

function renderResizeHandle(axis: ResizeHandleAxis, ref: React.Ref<HTMLElement>) {
  const e = RESIZE_EDGE
  const c = RESIZE_CORNER
  const style: React.CSSProperties =
    axis === 'n'  ? { top: 0,    left: c, right: c, width: 'auto', height: e, cursor: 'ns-resize' } :
    axis === 's'  ? { bottom: 0, left: c, right: c, width: 'auto', height: e, cursor: 'ns-resize' } :
    axis === 'e'  ? { right: 0,  top: c,  bottom: c, width: e, height: 'auto', cursor: 'ew-resize' } :
    axis === 'w'  ? { left: 0,   top: c,  bottom: c, width: e, height: 'auto', cursor: 'ew-resize' } :
    axis === 'ne' ? { top: 0,    right: 0,  width: c, height: c, cursor: 'ne-resize' } :
    axis === 'nw' ? { top: 0,    left: 0,   width: c, height: c, cursor: 'nw-resize' } :
    axis === 'se' ? { bottom: 0, right: 0,  width: c, height: c, cursor: 'se-resize' } :
                    { bottom: 0, left: 0,   width: c, height: c, cursor: 'sw-resize' }
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className="react-resizable-handle"
      style={{ position: 'absolute', backgroundImage: 'none', zIndex: 25, ...style }}
    />
  )
}

function EditBorder() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl border-2 border-dashed border-f1-red" />
  )
}

function HidePanelButton({ onHide }: { onHide: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onHide() }}
      className="absolute right-1.5 top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-400 hover:border-zinc-500 hover:text-white"
      title="Hide panel"
    >
      <svg viewBox="0 0 8 8" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth="1.5" fill="none">
        <path d="M1 1l6 6M7 1l-6 6" />
      </svg>
    </button>
  )
}

function DragHandle({ title }: { title: string }) {
  return (
    <div className="panel-drag-handle absolute -top-3 left-1/2 z-30 flex -translate-x-1/2 cursor-move items-center gap-1.5 rounded-full border border-f1-red/60 bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-100 shadow-lg">
      <span className="tracking-[0.25em] text-zinc-400">:::</span>
      {title}
    </div>
  )
}

function firstFreeY(items: Layout, w: number, h: number): number {
  let y = 0
  while (items.some((o) => w > o.x && y < o.y + o.h && y + h > o.y)) {
    y++
  }
  return y
}

function mergeMissingPanels(current: Layout, defaults: Layout): Layout {
  const present = new Set(current.map((i) => i.i))
  const missing = defaults.filter((d) => !present.has(d.i))
  if (missing.length === 0) return current
  const merged = [...current]
  for (const d of missing) {
    merged.push({ ...d, x: 0, y: firstFreeY(merged, d.w, d.h) })
  }
  return merged
}

function calcGrid(windowW: number, windowH: number) {
  const gridW = windowW - PAD_H
  const baseColWidth = Math.max(16, Math.floor((gridW - (BASE_COLS - 1) * GRID_MARGIN) / BASE_COLS))
  const availH = windowH - HEADER_H - PAD_TOP
  const baseRows = Math.max(1, Math.floor(availH / (baseColWidth + GRID_MARGIN)))
  const totalRows = baseRows * FINE
  const rowHeight = Math.max(2, availH / totalRows - GRID_MARGIN)
  return { gridWidth: gridW, rowHeight, totalRows }
}

export default function PanelGrid({
  scopeKey,
  category,
  sessionDefault,
  panelDefs,
  panels,
}: {
  scopeKey: string
  category: LayoutCategory
  sessionDefault: SessionDefault
  panelDefs: PanelDef[]
  panels: Record<string, React.ReactNode>
}) {
  const defaultLayout = sessionDefault.layout
  const { layout, setLayout, reset } = usePersistedLayout(`${LAYOUT_STORAGE_KEY}.${scopeKey}`, defaultLayout)
  const [grid, setGrid] = useState(() => calcGrid(window.innerWidth, window.innerHeight))

  useEffect(() => {
    const onResize = () => setGrid(calcGrid(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const {
    editMode, setActive, setEditMode, registerReset, hiddenPanels, hidePanel, showPanel,
    registerPanelDefs, registerShowPanel, registerLayoutAccessors, applyScope,
  } = useReplayLayout()

  useEffect(() => {
    applyScope(scopeKey, sessionDefault, category)
  }, [scopeKey, sessionDefault, category, applyScope])

  useEffect(() => {
    setActive(true)
    registerReset(reset)
    return () => {
      setActive(false)
      setEditMode(false)
      registerReset(null)
    }
  }, [setActive, setEditMode, registerReset, reset])

  useEffect(() => {
    registerPanelDefs(panelDefs)
    return () => registerPanelDefs([])
  }, [registerPanelDefs, panelDefs])

  const fullLayout = useMemo(() => mergeMissingPanels(layout, defaultLayout), [layout, defaultLayout])

  const layoutRef = useRef(fullLayout)
  useEffect(() => { layoutRef.current = fullLayout }, [fullLayout])
  const hiddenPanelsRef = useRef(hiddenPanels)
  useEffect(() => { hiddenPanelsRef.current = hiddenPanels }, [hiddenPanels])

  const handleShowPanel = useCallback((id: string) => {
    const visible = layoutRef.current.filter((item) => !hiddenPanelsRef.current.has(item.i))
    const current = layoutRef.current.find((item) => item.i === id)
    const w = current?.w ?? 6
    const h = current?.h ?? 4
    const targetY = firstFreeY(visible, w, h)
    setLayout(layoutRef.current.map((item) => item.i === id ? { ...item, x: 0, y: targetY } : item))
    showPanel(id)
  }, [showPanel, setLayout])

  useEffect(() => {
    registerShowPanel(handleShowPanel)
    return () => registerShowPanel(null)
  }, [registerShowPanel, handleShowPanel])

  useEffect(() => {
    registerLayoutAccessors(
      () => layoutRef.current,
      (l) => setLayout(l),
    )
    return () => registerLayoutAccessors(null, null)
  }, [registerLayoutAccessors, setLayout])

  const visibleLayout = fullLayout.filter((item) => !hiddenPanels.has(item.i))
  const renderItems = visibleLayout.filter((item) => panels[item.i] !== undefined)
  const labelById = useMemo(
    () => Object.fromEntries(panelDefs.map((p) => [p.id, p.label])),
    [panelDefs],
  )

  const persist = (l: Layout) => {
    const inL = new Set(l.map((i) => i.i))
    setLayout([...l, ...fullLayout.filter((item) => !inL.has(item.i))])
  }

  const panelOutline = editMode ? 'relative h-full cursor-move select-none' : 'relative h-full'
  const panelZ = (id: string): React.CSSProperties | undefined =>
    editMode ? { zIndex: (visibleLayout.find((i) => i.i === id)?.y ?? 0) + 1 } : undefined

  return (
    <div>
      <ReactGridLayout
        width={grid.gridWidth}
        layout={renderItems}
        onDragStop={persist}
        onResizeStop={persist}
        gridConfig={{ cols: COLS, rowHeight: grid.rowHeight, margin: [GRID_MARGIN, GRID_MARGIN], containerPadding: [0, 0] }}
        dragConfig={{ enabled: editMode, cancel: '.react-resizable-handle' }}
        resizeConfig={{ enabled: editMode, handles: RESIZE_HANDLES, handleComponent: renderResizeHandle }}
        compactor={FREE_COMPACTOR}
      >
        {renderItems.map((item) => (
          <div key={item.i} className={panelOutline} style={panelZ(item.i)}>
            {editMode ? <DragHandle title={labelById[item.i] ?? item.i} /> : null}
            {editMode ? <EditBorder /> : null}
            {editMode ? <HidePanelButton onHide={() => hidePanel(item.i)} /> : null}
            {panels[item.i]}
          </div>
        ))}
      </ReactGridLayout>
    </div>
  )
}
