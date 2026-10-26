import type { ChartPoint } from './chart'

/** A chart point whose identity survives re-layouts (usually its source timestamp). */
export interface KeyedChartPoint extends ChartPoint {
  key: number
}

/** Decelerating 0..1 easing curve, clamped at both ends. */
export function easeOutCubic(progress: number): number {
  const clamped = clamp01(progress)
  const remaining = 1 - clamped
  return 1 - remaining * remaining * remaining
}

/**
 * True when two layouts describe the same points in the same positions, so a
 * re-render would be visually identical. Metadata (hover labels) is ignored.
 */
export function sameLayout(a: readonly KeyedChartPoint[], b: readonly KeyedChartPoint[]): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index++) {
    const left = a[index]!
    const right = b[index]!
    if (left.key !== right.key || left.x !== right.x || left.y !== right.y) return false
  }
  return true
}

/**
 * Interpolate a chart layout toward another one, matching points by `key`.
 *
 * Points present in both layouts glide from their old position to the new one;
 * points only in `to` (a freshly arrived sample) appear at their target position;
 * points only in `from` (an evicted sample) are dropped. Target metadata (e.g.
 * hover time) is kept so the motion never renders stale labels.
 */
export function tweenPoints<T extends KeyedChartPoint>(
  from: readonly T[],
  to: readonly T[],
  progress: number,
): T[] {
  const t = clamp01(progress)
  const starts = new Map<number, T>()
  for (const point of from) starts.set(point.key, point)

  return to.map((point) => {
    const start = starts.get(point.key)
    if (!start || t === 1) return { ...point }
    return {
      ...point,
      x: start.x + (point.x - start.x) * t,
      y: start.y + (point.y - start.y) * t,
    }
  })
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}
