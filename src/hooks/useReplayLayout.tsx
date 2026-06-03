import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

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

  const registerReset = useCallback((fn: (() => void) | null) => {
    resetRef.current = fn
  }, [])

  const registerShowPanel = useCallback((fn: ((id: string) => void) | null) => {
    showPanelRef.current = fn
  }, [])

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

  const handleShowPanel = useCallback((id: string) => {
    if (showPanelRef.current) {
      showPanelRef.current(id)
    } else {
      showPanel(id)
    }
  }, [showPanel])

  const registerPanelDefs = useCallback((defs: PanelDef[]) => {
    setPanelDefs(defs)
  }, [])

  const value = useMemo(
    () => ({
      active, editMode, titleInfo, panelDefs, hiddenPanels,
      setActive, setEditMode, setTitleInfo, toggleEditMode,
      registerReset, reset, hidePanel, showPanel, handleShowPanel, registerShowPanel, registerPanelDefs,
    }),
    [active, editMode, titleInfo, panelDefs, hiddenPanels, toggleEditMode, registerReset, reset, hidePanel, showPanel, handleShowPanel, registerShowPanel, registerPanelDefs],
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
  const { active, editMode, toggleEditMode, reset, hiddenPanels, handleShowPanel, panelDefs } = useReplayLayout()
  if (!active) {
    return null
  }
  const hiddenDefs = panelDefs.filter((p) => hiddenPanels.has(p.id))
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
            onClick={reset}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
          >
            Reset layout
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={toggleEditMode}
        className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
          editMode
            ? 'border-sky-500 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
            : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
        }`}
      >
        {editMode ? 'Done' : 'Edit layout'}
      </button>
    </>
  )
}
