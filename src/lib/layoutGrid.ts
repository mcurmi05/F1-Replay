import type { Layout } from 'react-grid-layout'

export const BASE_COLS = 32
export const FINE = 5
export const COLS = BASE_COLS * FINE

export function scaleLayout(layout: Layout, factor: number): Layout {
  if (factor === 1) return layout
  return layout.map((item) => ({
    ...item,
    x: Math.round(item.x * factor),
    y: Math.round(item.y * factor),
    w: Math.max(1, Math.round(item.w * factor)),
    h: Math.max(1, Math.round(item.h * factor)),
    ...(item.minW != null ? { minW: Math.max(1, Math.round(item.minW * factor)) } : {}),
    ...(item.minH != null ? { minH: Math.max(1, Math.round(item.minH * factor)) } : {}),
    ...(item.maxW != null ? { maxW: Math.round(item.maxW * factor) } : {}),
    ...(item.maxH != null ? { maxH: Math.round(item.maxH * factor) } : {}),
  }))
}
