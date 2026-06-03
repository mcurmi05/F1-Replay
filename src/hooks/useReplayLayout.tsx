import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Layout } from 'react-grid-layout'

import { api } from '../lib/api/client'
import type { SavedLayoutMeta, SavedLayoutFull } from '../lib/api/client'

const HIDDEN_PANELS_KEY = 'f1replay.hiddenPanels.v1'

interface TitleInfo {
  eventName: string | null
  sessionName: string | null
  location: string | null
}

export interface PanelDef {
  id: string
  label: string
}

interface ReplayLayoutContextValue {
  active: boolean
  editMode: boolean
  titleInfo: TitleInfo | null
  panelDefs: PanelDef[]
  hiddenPanels: Set<string>
  setActive: (value: boolean) => void
  setEditMode: (value: boolean) => void
  setTitleInfo: (info: TitleInfo | null) => void
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
  const [panelDefs, setPanelDefs] = useState<PanelDef[]>([])
  const [hiddenPanels, setHiddenPanels] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(HIDDEN_PANELS_KEY)
      return new Set<string>(JSON.parse(saved ?? '[]'))
    } catch {
      return new Set()
    }
  })
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

  const reset = useCallback(() => {
    resetRef.current?.()
    setHiddenPanels(new Set())
    localStorage.removeItem(HIDDEN_PANELS_KEY)
  }, [])

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev)
  }, [])

  const hidePanel = useCallback((id: string) => {
    setHiddenPanels((prev) => {
      const next = new Set([...prev, id])
      localStorage.setItem(HIDDEN_PANELS_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const showPanel = useCallback((id: string) => {
    setHiddenPanels((prev) => {
      const next = new Set(prev)
      next.delete(id)
      localStorage.setItem(HIDDEN_PANELS_KEY, JSON.stringify([...next]))
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
    localStorage.setItem(HIDDEN_PANELS_KEY, JSON.stringify(ids))
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
      active, editMode, titleInfo, panelDefs, hiddenPanels,
      setActive, setEditMode, setTitleInfo, toggleEditMode,
      registerReset, reset, hidePanel, showPanel, handleShowPanel, registerShowPanel,
      replaceHiddenPanels, registerLayoutAccessors, callGetLayout, callSetLayout,
      registerPanelDefs,
    }),
    [
      active, editMode, titleInfo, panelDefs, hiddenPanels,
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
  const { active, titleInfo } = useReplayLayout()
  if (!active || !titleInfo) return null
  return (
    <>
      <span className="mx-2 h-5 w-px bg-zinc-800" />
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
    </>
  )
}

export function ReplayLayoutControls() {
  const {
    active, editMode, toggleEditMode, reset,
    hiddenPanels, handleShowPanel, panelDefs,
    replaceHiddenPanels, callGetLayout, callSetLayout,
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

  function openSaveModal() {
    setSaveName('')
    setSaveError(null)
    setShowSave(true)
  }

  async function doSave() {
    const name = saveName.trim()
    if (!name) return
    setSaving(true)
    setSaveError(null)
    try {
      await api.saveLayout(name, callGetLayout() as unknown[], [...hiddenPanels])
      setShowSave(false)
    } catch {
      setSaveError('Failed to save layout.')
    } finally {
      setSaving(false)
    }
  }

  function openLayoutsModal() {
    setEditingId(null)
    setConfirmDeleteId(null)
    setModalError(null)
    setShowLayouts(true)
    setLayoutsLoading(true)
    api
      .listLayouts()
      .then(setLayouts)
      .catch(() => setModalError('No cache folder selected, or could not load layouts.'))
      .finally(() => setLayoutsLoading(false))
  }

  async function doLoad(id: string) {
    setBusyId(id)
    setModalError(null)
    try {
      const full: SavedLayoutFull = await api.getLayout(id)
      callSetLayout(full.layout as unknown as Layout)
      replaceHiddenPanels(full.hiddenPanels)
      setShowLayouts(false)
    } catch {
      setModalError('Could not load layout.')
    } finally {
      setBusyId(null)
    }
  }

  async function doRename(id: string) {
    const name = editName.trim()
    if (!name) return
    setBusyId(id)
    try {
      const updated = await api.updateLayout(id, name)
      setLayouts((prev) => prev.map((l) => (l.id === id ? updated : l)))
      setEditingId(null)
    } catch {
      setModalError('Could not rename layout.')
    } finally {
      setBusyId(null)
    }
  }

  async function doOverwrite(id: string) {
    setBusyId(id)
    try {
      await api.updateLayout(id, undefined, callGetLayout() as unknown[], [...hiddenPanels])
      setEditingId(null)
    } catch {
      setModalError('Could not update layout.')
    } finally {
      setBusyId(null)
    }
  }

  async function doDelete(id: string) {
    setBusyId(id)
    try {
      await api.deleteLayout(id)
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
      {editMode ? (
        <>
          {hiddenDefs.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleShowPanel(p.id)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-sky-500/50 hover:text-zinc-200"
            >
              <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 shrink-0" stroke="currentColor" strokeWidth="1.5" fill="none">
                <path d="M4 1v6M1 4h6" />
              </svg>
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={openSaveModal}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
          >
            Save layout
          </button>
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
        onClick={openLayoutsModal}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
      >
        Layouts
      </button>
      <button
        type="button"
        onClick={toggleEditMode}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-800/50 ${
          editMode ? 'text-sky-400 hover:text-sky-300' : 'text-zinc-400 hover:text-white'
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
              className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none"
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
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
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
            {layoutsLoading ? (
              <p className="text-sm text-zinc-500">Loading...</p>
            ) : layouts.length === 0 && !modalError ? (
              <p className="text-sm text-zinc-500">No saved layouts yet.</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {layouts.map((item) => {
                  const isEditing = editingId === item.id
                  const isConfirmDelete = confirmDeleteId === item.id
                  const busy = busyId === item.id

                  if (isConfirmDelete) {
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5">
                        <span className="truncate text-sm text-zinc-300">Delete "{item.name}"?</span>
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
                      <li key={item.id} className="space-y-2 rounded-lg border border-sky-500/40 bg-zinc-900/60 px-3 py-2.5">
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void doRename(item.id) }}
                          className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none"
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
                            className="rounded bg-sky-600/25 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-600/40 disabled:opacity-50"
                          >
                            Overwrite with current
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
                        onClick={() => void doLoad(item.id)}
                        disabled={busy}
                        className="shrink-0 rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(item.id); setEditName(item.name) }}
                        className="shrink-0 rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-500 hover:border-f1-red/50 hover:text-f1-red"
                      >
                        x
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
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
