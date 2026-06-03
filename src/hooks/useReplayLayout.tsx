import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ReplayLayoutContextValue {
  active: boolean
  editMode: boolean
  setActive: (value: boolean) => void
  setEditMode: (value: boolean) => void
  toggleEditMode: () => void
  registerReset: (fn: (() => void) | null) => void
  reset: () => void
}

const ReplayLayoutContext = createContext<ReplayLayoutContextValue | null>(null)

export function ReplayLayoutProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const resetRef = useRef<(() => void) | null>(null)

  const registerReset = useCallback((fn: (() => void) | null) => {
    resetRef.current = fn
  }, [])

  const reset = useCallback(() => {
    resetRef.current?.()
  }, [])

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev)
  }, [])

  const value = useMemo(
    () => ({ active, editMode, setActive, setEditMode, toggleEditMode, registerReset, reset }),
    [active, editMode, toggleEditMode, registerReset, reset],
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

export function ReplayLayoutControls() {
  const { active, editMode, toggleEditMode, reset } = useReplayLayout()
  if (!active) {
    return null
  }
  return (
    <>
      <span className="mx-1 h-5 w-px bg-zinc-800" />
      {editMode ? (
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Reset layout
        </button>
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
