import type { SavedLayoutFull, SavedLayoutMeta } from './client'

// Browser-local layout storage. On a shared server deployment every visitor
// hits the same backend, so server-side layout files would be a single set that
// everyone overwrites. In the hosted build the api layout methods are routed
// here instead, giving each browser its own private layouts in localStorage.
// The method signatures, return shapes and error messages mirror the FastAPI
// layout endpoints exactly so the calling components need no changes.

const KEY_PREFIX = 'f1replay.layouts.'

interface StoredLayout {
  name: string
  layout: unknown[]
  hiddenPanels: string[]
  timingColumns?: unknown[] | null
  cols?: number | null
}

function storageKey(category: string): string {
  return `${KEY_PREFIX}${category.toLowerCase()}`
}

function readAll(category: string): StoredLayout[] {
  try {
    const raw = localStorage.getItem(storageKey(category))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredLayout[]) : []
  } catch {
    return []
  }
}

function writeAll(category: string, items: StoredLayout[]): void {
  localStorage.setItem(storageKey(category), JSON.stringify(items))
}

// Mirror the backend _sanitize_name: drop characters illegal in a filename,
// trim surrounding whitespace and dots, reject an empty result.
function sanitizeName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const safe = name.replace(/[/\\:*?"<>|\x00]/g, '').trim().replace(/^\.+|\.+$/g, '')
  if (!safe) {
    throw new Error('Invalid layout name')
  }
  return safe
}

export function listLayouts(category: string): Promise<SavedLayoutMeta[]> {
  const items = readAll(category)
  return Promise.resolve(items.map((it) => ({ id: it.name, name: it.name })))
}

export function getLayout(category: string, id: string): Promise<SavedLayoutFull> {
  const name = sanitizeName(id)
  const item = readAll(category).find((it) => it.name === name)
  if (!item) {
    return Promise.reject(new Error('Layout not found'))
  }
  return Promise.resolve({
    id: item.name,
    name: item.name,
    layout: item.layout,
    hiddenPanels: item.hiddenPanels,
    timingColumns: item.timingColumns ?? null,
    cols: item.cols ?? null,
  })
}

export function saveLayout(
  category: string,
  name: string,
  layout: unknown[],
  hiddenPanels: string[],
  timingColumns?: unknown[] | null,
  cols?: number,
): Promise<SavedLayoutMeta> {
  const safe = sanitizeName(name)
  const items = readAll(category)
  if (items.some((it) => it.name === safe)) {
    return Promise.reject(new Error('A layout with that name already exists'))
  }
  items.push({
    name: safe,
    layout,
    hiddenPanels,
    timingColumns: timingColumns ?? null,
    cols: cols ?? null,
  })
  writeAll(category, items)
  return Promise.resolve({ id: safe, name: safe })
}

export function updateLayout(
  category: string,
  id: string,
  name?: string,
  layout?: unknown[],
  hiddenPanels?: string[],
  timingColumns?: unknown[] | null,
  cols?: number,
): Promise<SavedLayoutMeta> {
  const oldName = sanitizeName(id)
  const items = readAll(category)
  const index = items.findIndex((it) => it.name === oldName)
  if (index === -1) {
    return Promise.reject(new Error('Layout not found'))
  }
  const data = items[index]
  if (layout !== undefined) {
    data.layout = layout
    // Match the backend: setting a new layout without timing columns clears them.
    data.timingColumns = timingColumns !== undefined ? timingColumns : null
  } else if (timingColumns !== undefined) {
    data.timingColumns = timingColumns
  }
  if (cols !== undefined) data.cols = cols
  if (hiddenPanels !== undefined) data.hiddenPanels = hiddenPanels

  let finalName = oldName
  if (name !== undefined) {
    const newName = sanitizeName(name)
    if (newName !== oldName && items.some((it) => it.name === newName)) {
      return Promise.reject(new Error('A layout with that name already exists'))
    }
    data.name = newName
    finalName = newName
  }
  // Move to the end so ordering tracks most-recently-modified, like the backend
  // which sorts by file mtime.
  items.splice(index, 1)
  items.push(data)
  writeAll(category, items)
  return Promise.resolve({ id: finalName, name: finalName })
}

export function deleteLayout(category: string, id: string): Promise<{ ok: boolean }> {
  const name = sanitizeName(id)
  const items = readAll(category).filter((it) => it.name !== name)
  writeAll(category, items)
  return Promise.resolve({ ok: true })
}
