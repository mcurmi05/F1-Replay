import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Layout } from 'react-grid-layout'

import editPencilIcon from '../assets/edit_pencil.png'
import binDeleteIcon from '../assets/bin_delete.png'
import skipBackwardIcon from '../assets/skip_backward.png'
import skipForwardIcon from '../assets/skip_forward.png'
import { api } from '../lib/api/client'
import type { SavedLayoutMeta, SavedLayoutFull } from '../lib/api/client'
import { BASE_COLS, COLS, scaleLayout } from '../lib/layoutGrid'
import type { TimingColumnState } from '../lib/timingColumns'
import type { SessionDefault, LayoutCategory } from '../lib/defaultLayouts'
import type { WeatherSample } from '../lib/api/types'

const HIDDEN_PANELS_KEY = 'f1replay.hiddenPanels.v2'
const TIMING_COLUMNS_KEY = 'f1replay.timingColumns.v2'

const keyFor = (base: string, scope: string | null) => (scope ? `${base}.${scope}` : base)

interface TitleInfo {
  eventName: string | null
  sessionName: string | null
  location: string | null
}

interface StatusInfo {
  status: { color: string; background: string; flag: string; label: string }
  weather: WeatherSample | null
}

export interface PanelDef {
  id: string
  label: string
}

interface SessionNav {
  prev: string | null
  next: string | null
}

interface ReplayLayoutContextValue {
  active: boolean
  editMode: boolean
  titleInfo: TitleInfo | null
  statusInfo: StatusInfo | null
  sessionNav: SessionNav | null
  setSessionNav: (nav: SessionNav | null) => void
  trackRotation: number
  panelDefs: PanelDef[]
  hiddenPanels: Set<string>
  timingColumns: TimingColumnState[] | null
  setTimingColumns: (next: TimingColumnState[] | null) => void
  category: LayoutCategory | null
  applyScope: (scope: string, def: SessionDefault, category: LayoutCategory) => void
  setActive: (value: boolean) => void
  setEditMode: (value: boolean) => void
  setTitleInfo: (info: TitleInfo | null) => void
  setStatusInfo: (info: StatusInfo | null) => void
  setTrackRotation: (n: number) => void
  toggleEditMode: () => void
  registerReset: (fn: (() => void) | null) => void
  reset: () => void
  hidePanel: (id: string) => void
  showPanel: (id: string) => void
  handleShowPanel: (id: string) => void
  registerShowPanel: (fn: ((id: string) => void) | null) => void
  replaceHiddenPanels: (ids: string[]) => void
  registerLayoutAccessors: (get: (() => Layout) | null, set: ((l: Layout) => void) | null) => void
  callGetLayout: () => Layout
  callSetLayout: (l: Layout) => void
  registerPanelDefs: (defs: PanelDef[]) => void
}

const ReplayLayoutContext = createContext<ReplayLayoutContextValue | null>(null)

export function ReplayLayoutProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [titleInfo, setTitleInfo] = useState<TitleInfo | null>(null)
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null)
  const [sessionNav, setSessionNav] = useState<SessionNav | null>(null)
  const [trackRotation, setTrackRotation] = useState(0)
  const [panelDefs, setPanelDefs] = useState<PanelDef[]>([])
  const [hiddenPanels, setHiddenPanels] = useState<Set<string>>(new Set())
  const [timingColumns, setTimingColumnsState] = useState<TimingColumnState[] | null>(null)
  const [category, setCategory] = useState<LayoutCategory | null>(null)
  const scopeRef = useRef<string | null>(null)
  const defaultRef = useRef<SessionDefault | null>(null)
  const resetRef = useRef<(() => void) | null>(null)
  const showPanelRef = useRef<((id: string) => void) | null>(null)
  const getLayoutRef = useRef<(() => Layout) | null>(null)
  const setLayoutRef = useRef<((l: Layout) => void) | null>(null)

  const registerReset = useCallback((fn: (() => void) | null) => {
    resetRef.current = fn
  }, [])

  const registerShowPanel = useCallback((fn: ((id: string) => void) | null) => {
    showPanelRef.current = fn
  }, [])

  const registerLayoutAccessors = useCallback(
    (get: (() => Layout) | null, set: ((l: Layout) => void) | null) => {
      getLayoutRef.current = get
      setLayoutRef.current = set
    },
    [],
  )

  const applyScope = useCallback((scope: string, def: SessionDefault, cat: LayoutCategory) => {
    scopeRef.current = scope
    defaultRef.current = def
    setCategory(cat)
    try {
      const rawHidden = localStorage.getItem(keyFor(HIDDEN_PANELS_KEY, scope))
      setHiddenPanels(new Set<string>(rawHidden ? JSON.parse(rawHidden) : def.hiddenPanels))
    } catch {
      setHiddenPanels(new Set(def.hiddenPanels))
    }
    try {
      const rawCols = localStorage.getItem(keyFor(TIMING_COLUMNS_KEY, scope))
      setTimingColumnsState(rawCols ? (JSON.parse(rawCols) as TimingColumnState[]) : def.timingColumns)
    } catch {
      setTimingColumnsState(def.timingColumns)
    }
  }, [])

  const setTimingColumns = useCallback((next: TimingColumnState[] | null) => {
    setTimingColumnsState(next)
    const key = keyFor(TIMING_COLUMNS_KEY, scopeRef.current)
    if (next === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(next))
    }
  }, [])

  const reset = useCallback(() => {
    resetRef.current?.()
    const def = defaultRef.current
    setHiddenPanels(new Set(def?.hiddenPanels ?? []))
    setTimingColumnsState(def?.timingColumns ?? null)
    localStorage.removeItem(keyFor(HIDDEN_PANELS_KEY, scopeRef.current))
    localStorage.removeItem(keyFor(TIMING_COLUMNS_KEY, scopeRef.current))
  }, [])

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev)
  }, [])

  const hidePanel = useCallback((id: string) => {
    setHiddenPanels((prev) => {
      const next = new Set([...prev, id])
      localStorage.setItem(keyFor(HIDDEN_PANELS_KEY, scopeRef.current), JSON.stringify([...next]))
      return next
    })
  }, [])

  const showPanel = useCallback((id: string) => {
    setHiddenPanels((prev) => {
      const next = new Set(prev)
      next.delete(id)
      localStorage.setItem(keyFor(HIDDEN_PANELS_KEY, scopeRef.current), JSON.stringify([...next]))
      return next
    })
  }, [])

  const handleShowPanel = useCallback(
    (id: string) => {
      if (showPanelRef.current) {
        showPanelRef.current(id)
      } else {
        showPanel(id)
      }
    },
    [showPanel],
  )

  const replaceHiddenPanels = useCallback((ids: string[]) => {
    const next = new Set(ids)
    setHiddenPanels(next)
    localStorage.setItem(keyFor(HIDDEN_PANELS_KEY, scopeRef.current), JSON.stringify(ids))
  }, [])

  const callGetLayout = useCallback((): Layout => {
    return getLayoutRef.current?.() ?? []
  }, [])

  const callSetLayout = useCallback((l: Layout) => {
    setLayoutRef.current?.(l)
  }, [])

  const registerPanelDefs = useCallback((defs: PanelDef[]) => {
    setPanelDefs(defs)
  }, [])

  const value = useMemo(
    () => ({
      active, editMode, titleInfo, statusInfo, sessionNav, setSessionNav, trackRotation, panelDefs, hiddenPanels, timingColumns, setTimingColumns, category, applyScope,
      setActive, setEditMode, setTitleInfo, setStatusInfo, setTrackRotation, toggleEditMode,
      registerReset, reset, hidePanel, showPanel, handleShowPanel, registerShowPanel,
      replaceHiddenPanels, registerLayoutAccessors, callGetLayout, callSetLayout,
      registerPanelDefs,
    }),
    [
      active, editMode, titleInfo, statusInfo, sessionNav, trackRotation, panelDefs, hiddenPanels, timingColumns, setTimingColumns, category, applyScope,
      toggleEditMode, registerReset, reset, hidePanel, showPanel, handleShowPanel, registerShowPanel,
      replaceHiddenPanels, registerLayoutAccessors, callGetLayout, callSetLayout,
      registerPanelDefs,
    ],
  )

  return <ReplayLayoutContext.Provider value={value}>{children}</ReplayLayoutContext.Provider>
}

export function useReplayLayout() {
  const ctx = useContext(ReplayLayoutContext)
  if (!ctx) {
    throw new Error('useReplayLayout must be used within ReplayLayoutProvider')
  }
  return ctx
}

export function ReplayTitleBadge() {
  const { active, titleInfo, sessionNav } = useReplayLayout()
  const navigate = useNavigate()
  if (!active || !titleInfo) return null
  return (
    <>
      <span className="mx-2 h-5 w-px bg-zinc-800" />
      {sessionNav ? (
        sessionNav.prev ? (
          <button
            type="button"
            onClick={() => navigate(sessionNav.prev!)}
            title="Previous session"
            className="flex items-center justify-center rounded p-1 text-zinc-400 hover:bg-zinc-800/60 hover:text-white transition-colors"
          >
            <img src={skipBackwardIcon} alt="Previous session" className="h-5 w-5 opacity-70" />
          </button>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded p-1 opacity-20">
            <img src={skipBackwardIcon} alt="" className="h-5 w-5" />
          </span>
        )
      ) : null}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-white">{titleInfo.eventName}</span>
        {titleInfo.sessionName ? (
          <>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{titleInfo.sessionName}</span>
          </>
        ) : null}
        {titleInfo.location ? (
          <>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">{titleInfo.location}</span>
          </>
        ) : null}
      </div>
      {sessionNav ? (
        sessionNav.next ? (
          <button
            type="button"
            onClick={() => navigate(sessionNav.next!)}
            title="Next session"
            className="flex items-center justify-center rounded p-1 text-zinc-400 hover:bg-zinc-800/60 hover:text-white transition-colors"
          >
            <img src={skipForwardIcon} alt="Next session" className="h-5 w-5 opacity-70" />
          </button>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded p-1 opacity-20">
            <img src={skipForwardIcon} alt="" className="h-5 w-5" />
          </span>
        )
      ) : null}
    </>
  )
}

function formatStat(value: number | null, suffix: string, digits = 0): string {
  if (value === null) return '-'
  return `${value.toFixed(digits)}${suffix}`
}

function StatItem({ label, value, dir }: { label: string; value: string; dir?: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      {dir !== undefined ? (
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3 shrink-0 text-white"
          style={{ transform: `rotate(${dir}deg)` }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21V4M12 4l-5 6M12 4l5 6" />
        </svg>
      ) : null}
      <span className="font-mono font-semibold text-white">{value}</span>
    </span>
  )
}

export function ReplayStatusBar() {
  const { active, statusInfo, trackRotation } = useReplayLayout()
  if (!active || !statusInfo) return null
  const { status, weather } = statusInfo
  return (
    <div className="flex items-center gap-2">
      <span className="mx-1 h-5 w-px bg-zinc-800" />
      <span
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold"
        style={{ color: status.color, backgroundColor: status.background }}
      >
        <img src={status.flag} alt="" className="h-4 w-4" />
        {status.label}
      </span>
      {weather ? (
        <div className="flex items-center gap-2.5 rounded-md bg-zinc-900/60 px-2.5 py-1 text-xs">
          {weather.rainfall ? (
            <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Rain
            </span>
          ) : null}
          <StatItem label="Track" value={formatStat(weather.track_temp, '°', 1)} />
          <StatItem label="Air" value={formatStat(weather.air_temp, '°', 1)} />
          <StatItem label="Hum" value={formatStat(weather.humidity, '%', 0)} />
          <StatItem label="Pres" value={formatStat(weather.pressure, '', 0)} />
          <StatItem label="Wind (Relative to trackmap)" value={formatStat(weather.wind_speed, '', 1)} dir={(weather.wind_direction ?? 0) + trackRotation} />
        </div>
      ) : null}
    </div>
  )
}

export function ReplayLayoutControls() {
  const {
    active, editMode, toggleEditMode, reset,
    hiddenPanels, handleShowPanel, panelDefs,
    replaceHiddenPanels, callGetLayout, callSetLayout,
    timingColumns, setTimingColumns, category,
  } = useReplayLayout()

  const [showSave, setShowSave] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [showLayouts, setShowLayouts] = useState(false)
  const [layouts, setLayouts] = useState<SavedLayoutMeta[]>([])
  const [layoutsLoading, setLayoutsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  if (!active) return null

  const hiddenDefs = panelDefs.filter((p) => hiddenPanels.has(p.id))
  const leaf = category ? category.split('-').pop()! : ''
  const defaultName = leaf ? `${leaf[0].toUpperCase()}${leaf.slice(1)} Default` : 'Default'
  const customLayouts = layouts.filter((l) => l.name !== defaultName)

  function openSaveModal() {
    setSaveName('')
    setSaveError(null)
    setShowSave(true)
  }

  async function doSave() {
    const name = saveName.trim()
    if (!name || !category) return
    setSaving(true)
    setSaveError(null)
    try {
      await api.saveLayout(category, name, callGetLayout() as unknown[], [...hiddenPanels], timingColumns, COLS)
      setShowSave(false)
    } catch {
      setSaveError('Failed to save layout.')
    } finally {
      setSaving(false)
    }
  }

  function openLayoutsModal() {
    if (!category) return
    setEditingId(null)
    setConfirmDeleteId(null)
    setModalError(null)
    setShowLayouts(true)
    setLayoutsLoading(true)
    api
      .listLayouts(category)
      .then(setLayouts)
      .catch(() => setModalError('No cache folder selected, or could not load layouts.'))
      .finally(() => setLayoutsLoading(false))
  }

  async function doLoad(id: string) {
    if (!category) return
    setBusyId(id)
    setModalError(null)
    try {
      const full: SavedLayoutFull = await api.getLayout(category, id)
      const savedCols = full.cols ?? BASE_COLS
      callSetLayout(scaleLayout(full.layout as unknown as Layout, COLS / savedCols))
      replaceHiddenPanels(full.hiddenPanels)
      setTimingColumns((full.timingColumns as TimingColumnState[] | null | undefined) ?? null)
      setShowLayouts(false)
    } catch {
      setModalError('Could not load layout.')
    } finally {
      setBusyId(null)
    }
  }

  async function doRename(id: string) {
    const name = editName.trim()
    if (!name || !category) return
    setBusyId(id)
    try {
      const updated = await api.updateLayout(category, id, name)
      setLayouts((prev) => prev.map((l) => (l.id === id ? updated : l)))
      setEditingId(null)
    } catch {
      setModalError('Could not rename layout.')
    } finally {
      setBusyId(null)
    }
  }

  async function doOverwrite(id: string) {
    if (!category) return
    setBusyId(id)
    try {
      await api.updateLayout(category, id, undefined, callGetLayout() as unknown[], [...hiddenPanels], timingColumns, COLS)
      setEditingId(null)
    } catch {
      setModalError('Could not update layout.')
    } finally {
      setBusyId(null)
    }
  }

  async function doDelete(id: string) {
    if (!category) return
    setBusyId(id)
    try {
      await api.deleteLayout(category, id)
      setLayouts((prev) => prev.filter((l) => l.id !== id))
      setConfirmDeleteId(null)
    } catch {
      setModalError('Could not delete layout.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <span className="mx-1 h-5 w-px bg-zinc-800" />
      <button
        type="button"
        onClick={openLayoutsModal}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
      >
        Layouts
      </button>
      <button
        type="button"
        onClick={openSaveModal}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
      >
        Save layout
      </button>
      {editMode ? (
        <>
          {hiddenDefs.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleShowPanel(p.id)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-f1-red/50 hover:text-zinc-200"
            >
              <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 shrink-0" stroke="currentColor" strokeWidth="1.5" fill="none">
                <path d="M4 1v6M1 4h6" />
              </svg>
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
          >
            Reset
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={toggleEditMode}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-800/50 ${
          editMode ? 'text-f1-red hover:text-red-400' : 'text-zinc-400 hover:text-white'
        }`}
      >
        {editMode ? 'Done' : 'Edit UI'}
      </button>

      {showSave ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => !saving && setShowSave(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">Save layout</h2>
            <input
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void doSave() }}
              placeholder="Layout name"
              className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-200 focus:border-f1-red focus:outline-none"
            />
            {saveError ? <p className="mt-2 text-xs text-f1-red">{saveError}</p> : null}
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSave(false)}
                disabled={saving}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void doSave()}
                disabled={saving || !saveName.trim()}
                className="rounded-lg bg-f1-red px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      , document.body) : null}

      {showLayouts ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setShowLayouts(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold text-white">Saved layouts</h2>
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              <li className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2">
                <span className="flex-1 truncate text-sm text-zinc-200">{defaultName}</span>
                <button
                  type="button"
                  onClick={() => { reset(); setShowLayouts(false) }}
                  className="shrink-0 rounded bg-f1-red px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110"
                >
                  Load
                </button>
              </li>
              {layoutsLoading ? (
                <li className="text-sm text-zinc-500 px-1 py-1">Loading...</li>
              ) : customLayouts.length === 0 && !modalError ? (
                <li className="text-sm text-zinc-500 px-1 py-1">No saved layouts yet.</li>
              ) : customLayouts.map((item) => {
                  const isEditing = editingId === item.id
                  const isConfirmDelete = confirmDeleteId === item.id
                  const busy = busyId === item.id

                  if (isConfirmDelete) {
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5">
                        <span className="truncate text-sm text-zinc-300">Delete {item.name}?</span>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void doDelete(item.id)}
                            disabled={busy}
                            className="rounded bg-f1-red px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )
                  }

                  if (isEditing) {
                    return (
                      <li key={item.id} className="space-y-2 rounded-lg border border-f1-red/40 bg-zinc-900/60 px-3 py-2.5">
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void doRename(item.id) }}
                          className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-f1-red focus:outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void doRename(item.id)}
                            disabled={busy || !editName.trim()}
                            className="rounded border border-zinc-600 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => void doOverwrite(item.id)}
                            disabled={busy}
                            className="rounded bg-f1-red/20 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-f1-red/35 disabled:opacity-50"
                          >
                            Overwrite with current layout
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </li>
                    )
                  }

                  return (
                    <li key={item.id} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2">
                      <span className="flex-1 truncate text-sm text-zinc-200">{item.name}</span>
                      <button
                        type="button"
                        onClick={() => { setEditingId(item.id); setEditName(item.name) }}
                        className="shrink-0 p-1 opacity-50 hover:opacity-100"
                      >
                        <img src={editPencilIcon} alt="Edit" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="shrink-0 p-1 opacity-50 hover:opacity-100"
                      >
                        <img src={binDeleteIcon} alt="Delete" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void doLoad(item.id)}
                        disabled={busy}
                        className="shrink-0 rounded bg-f1-red px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                      >
                        Load
                      </button>
                    </li>
                  )
                })}
            </ul>
            {modalError ? <p className="mt-3 text-xs text-f1-red">{modalError}</p> : null}
            <button
              type="button"
              onClick={() => setShowLayouts(false)}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
        </div>
      , document.body) : null}
    </>
  )
}
