export interface GaugeScale {
  min: number
  max: number
}

/**
 * The finite value range of a gauge series, padded when every point is equal
 * so a flat series still leaves room for the marker to move.
 */
export function observedGaugeScale(values: readonly number[]): GaugeScale | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
  }

  if (min === Number.POSITIVE_INFINITY) return null
  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.1, 1)
    return { min: min - padding, max: max + padding }
  }
  return { min, max }
}

/** A persisted, per-metric gauge range. Invalid overrides are ignored. */
export function resolveGaugeScale(
  values: readonly number[],
  override?: GaugeScale | null,
): GaugeScale {
  if (override && validScale(override)) return override
  return observedGaugeScale(values) ?? { min: 0, max: 1 }
}

/** Map a value onto the gauge track, clamping values outside the scale. */
export function gaugeFraction(value: number | null, scale: GaugeScale): number {
  if (value === null || !Number.isFinite(value) || !validScale(scale)) return 0
  return clamp((value - scale.min) / (scale.max - scale.min), 0, 1)
}

export function gaugeValueOutsideScale(value: number | null, scale: GaugeScale): boolean {
  return value !== null && Number.isFinite(value) && (value < scale.min || value > scale.max)
}

/** Keep only valid metric → scale entries from persisted settings. */
export function sanitizeGaugeScales(input: unknown): Record<string, GaugeScale> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}

  const scales: Record<string, GaugeScale> = {}
  for (const [name, value] of Object.entries(input)) {
    if (value && typeof value === 'object' && validScale(value as GaugeScale)) {
      scales[name] = { min: (value as GaugeScale).min, max: (value as GaugeScale).max }
    }
  }
  return scales
}

function validScale(scale: GaugeScale): boolean {
  return Number.isFinite(scale.min) && Number.isFinite(scale.max) && scale.max > scale.min
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
