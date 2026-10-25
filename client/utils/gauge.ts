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

/** The observed gauge range, with a safe fallback for an empty series. */
export function resolveGaugeScale(values: readonly number[]): GaugeScale {
  return observedGaugeScale(values) ?? { min: 0, max: 1 }
}

/** Map a value onto the gauge track, clamping values outside the scale. */
export function gaugeFraction(value: number | null, scale: GaugeScale): number {
  if (value === null || !Number.isFinite(value) || !validScale(scale)) return 0
  return clamp((value - scale.min) / (scale.max - scale.min), 0, 1)
}

/** Value at a normalized position along the gauge scale, clamped to the scale. */
export function gaugeValueAtFraction(scale: GaugeScale, fraction: number): number {
  if (!validScale(scale)) return scale.min
  const position = Number.isFinite(fraction) ? clamp(fraction, 0, 1) : 0
  return scale.min + position * (scale.max - scale.min)
}

function validScale(scale: GaugeScale): boolean {
  return Number.isFinite(scale.min) && Number.isFinite(scale.max) && scale.max > scale.min
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
