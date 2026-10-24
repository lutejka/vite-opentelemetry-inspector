/**
 * Pure formatting helpers shared by the display components, plus the
 * severity/age → `color-scale-*` mappings. Re-implemented once here instead of
 * being duplicated in every badge across the source projects.
 */

/**
 * The severity color-scale class names (see `color-scale-*` in `styles/utilities.css`).
 *
 * Maps each severity level to its `color-scale-*` CSS class, ordered from least
 * to most severe.
 *
 * @example
 * colorScale.neutral // → 'color-scale-neutral'
 * colorScale.critical // → 'color-scale-critical'
 */
export const colorScale = {
  neutral: 'color-scale-neutral',
  low: 'color-scale-low',
  medium: 'color-scale-medium',
  high: 'color-scale-high',
  critical: 'color-scale-critical',
} as const

export type ColorScaleClass = (typeof colorScale)[keyof typeof colorScale]
export type SeverityScale = readonly (readonly [max: number, cls: ColorScaleClass])[]

/**
 * Map a value through an ascending threshold scale to a color-scale class.
 *
 * Returns the class of the first `[max, cls]` entry whose `max` the value does
 * not exceed; if the value is above every threshold, the last entry's class is
 * returned.
 *
 * @param value - The numeric value to classify.
 * @param scale - Ascending list of `[max, colorScaleClass]` thresholds.
 * @returns The matching {@link ColorScaleClass}.
 *
 * @example
 * mapSeverity(999, [[10, 'color-scale-low']]) // → 'color-scale-low' (above all thresholds)
 */
export function mapSeverity(value: number, scale: SeverityScale): ColorScaleClass {
  for (const [max, cls] of scale) {
    if (value <= max) {
      return cls
    }
  }
  return scale.at(-1)?.[1] ?? colorScale.neutral
}

// ── Locale ──────────────────────────────────────────────────────────────────

/**
 * The default BCP-47 locale used by the `Intl`-backed formatters
 * (`formatNumber`, `formatDateTime`) when no `locale` argument is passed.
 */
const DEFAULT_LOCALE = 'en-US'

// ── Numbers ───────────────────────────────────────────────────────────────

/**
 * Format a number with locale-aware grouping via `Intl.NumberFormat`.
 *
 * @param value - The number to format.
 * @param options - Optional `Intl.NumberFormatOptions` to customize formatting.
 * @param locale - BCP-47 locale tag. Defaults to `'en-US'`.
 * @returns The formatted, grouped number string.
 *
 * @example
 * formatNumber(1234567) // → '1,234,567'
 * formatNumber(1234567, undefined, 'de-DE') // → '1.234.567'
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions, locale?: string): string {
  return new Intl.NumberFormat(locale ?? DEFAULT_LOCALE, options).format(value)
}

// ── Durations ───────────────────────────────────────────────────────────────

/** Input time unit accepted by {@link formatDuration}. */
export type DurationUnit = 'ns' | 'us' | 'ms' | 's'

const DURATION_FACTOR_MS: Record<DurationUnit, number> = { ns: 1e-6, us: 1e-3, ms: 1, s: 1000 }

/**
 * Humanize a duration → `[value, unit]`, accepting nanosecond/microsecond input.
 *
 * Input is interpreted in `options.unit` (default `'ms'`) and scaled to
 * milliseconds, then formatted: sub-millisecond values from a finer input unit
 * render as `ns`/`µs`, otherwise the ladder runs `ms` → `s` → `min` → `h` → `d`.
 * For backwards compatibility a sub-1 **ms** input still renders `['<1', 'ms']`,
 * and `null`/`undefined` renders `['', '-']`.
 *
 * @param value - The duration in `options.unit`, or `null`/`undefined` for no value.
 * @param options - Formatting options.
 * @param options.unit - Input unit: `'ns'`, `'us'`, `'ms'` (default) or `'s'`.
 * @returns A `[value, unit]` tuple, e.g. `['1.5', 's']`.
 *
 * @example
 * formatDuration(null) // → ['', '-']
 * formatDuration(0.5) // → ['<1', 'ms']
 * formatDuration(250) // → ['250', 'ms']
 * formatDuration(1500) // → ['1.5', 's']
 * formatDuration(1500, { unit: 'ns' }) // → ['1.5', 'µs']
 * formatDuration(820, { unit: 'us' }) // → ['820', 'µs']
 */
export function formatDuration(
  value: number | null | undefined,
  options: { unit?: DurationUnit } = {},
): [string, string] {
  if (value == null) {
    return ['', '-']
  }
  const unit = options.unit ?? 'ms'
  const ms = value * DURATION_FACTOR_MS[unit]
  if (ms < 1) {
    if (unit === 'ms') {
      return ['<1', 'ms']
    }
    const us = ms * 1000
    if (us < 1) {
      return [Math.round(us * 1000).toString(), 'ns']
    }
    return [(us < 10 ? us.toFixed(1) : us.toFixed(0)).replace(/\.0$/, ''), 'µs']
  }
  if (ms < 1000) {
    return [ms.toFixed(0), 'ms']
  }
  if (ms < 60_000) {
    return [(ms / 1000).toFixed(1), 's']
  }
  if (ms < 3_600_000) {
    return [(ms / 60_000).toFixed(1), 'min']
  }
  if (ms < 86_400_000) {
    return [(ms / 3_600_000).toFixed(1), 'h']
  }
  return [(ms / 86_400_000).toFixed(1), 'd']
}

/** Default severity thresholds (in ms) for durations. Pass a custom one to {@link getDurationColor}. */
export const DURATION_SCALE: SeverityScale = [
  [50, colorScale.neutral],
  [200, colorScale.low],
  [1000, colorScale.medium],
  [5000, colorScale.high],
  [Number.POSITIVE_INFINITY, colorScale.critical],
]

/**
 * Color a duration on a severity scale (fast = neutral, slow = critical).
 *
 * Default thresholds: ≤50 ms neutral, ≤200 ms low, ≤1000 ms medium, ≤5000 ms high, else critical.
 *
 * @param ms - The duration in milliseconds to classify.
 * @param scale - Ascending threshold scale (in ms). Defaults to {@link DURATION_SCALE}.
 * @returns The matching {@link ColorScaleClass}.
 *
 * @example
 * getDurationColor(30) // → 'color-scale-neutral'
 * getDurationColor(500) // → 'color-scale-medium'
 * getDurationColor(10_000) // → 'color-scale-critical'
 */
export function getDurationColor(ms: number, scale: SeverityScale = DURATION_SCALE): ColorScaleClass {
  return mapSeverity(ms, scale)
}

// ── Relative time ─────────────────────────────────────────────────────────

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const TIME_UNITS: readonly (readonly [limit: number, divisor: number, unit: string])[] = [
  [MINUTE, SECOND, 's'],
  [HOUR, MINUTE, 'min'],
  [DAY, HOUR, 'h'],
  [MONTH, DAY, 'd'],
  [YEAR, MONTH, 'mo'],
  [Number.POSITIVE_INFINITY, YEAR, 'y'],
]

/**
 * No-dependency relative time: `"3 d ago"`, `"in 2 h"`, `"just now"`.
 *
 * Computes the signed delta between `input` and `now`, picks the largest unit
 * (`s`/`min`/`h`/`d`/`mo`/`y`) and renders past times as `"N unit ago"` and
 * future times as `"in N unit"`. Deltas under a second are `"just now"`.
 *
 * @param input - The timestamp to describe, as a `Date` or epoch milliseconds.
 * @param now - Reference time in epoch milliseconds. Defaults to `Date.now()`.
 * @returns A human-readable relative time string.
 *
 * @example
 * const now = 1_000_000_000_000
 * formatTimeAgo(now, now) // → 'just now'
 * formatTimeAgo(now - 3 * 86_400_000, now) // → '3 d ago'
 * formatTimeAgo(now + 2 * 3_600_000, now) // → 'in 2 h'
 */
export function formatTimeAgo(input: Date | number, now: number = Date.now()): string {
  const time = input instanceof Date ? input.getTime() : input
  const delta = now - time
  const abs = Math.abs(delta)
  if (abs < SECOND) {
    return 'just now'
  }
  for (const [limit, divisor, unit] of TIME_UNITS) {
    if (abs < limit) {
      const value = Math.round(abs / divisor)
      return delta >= 0 ? `${value} ${unit} ago` : `in ${value} ${unit}`
    }
  }
  return ''
}

/** Default severity thresholds (in ms of age) for freshness. Pass a custom one to {@link getAgeColor}. */
export const AGE_SCALE: SeverityScale = [
  [180 * DAY, colorScale.neutral],
  [365 * DAY, colorScale.low],
  [3 * YEAR, colorScale.medium],
  [5 * YEAR, colorScale.high],
  [Number.POSITIVE_INFINITY, colorScale.critical],
]

/**
 * Color an age (ms since something) on the freshness scale.
 *
 * Default thresholds: ≤180 d neutral, ≤365 d low, ≤3 y medium, ≤5 y high, else critical.
 *
 * @param ageMs - The age in milliseconds to classify.
 * @param scale - Ascending threshold scale (in ms). Defaults to {@link AGE_SCALE}.
 * @returns The matching {@link ColorScaleClass}.
 *
 * @example
 * getAgeColor(10 * 86_400_000) // → 'color-scale-neutral' (10 days old)
 */
export function getAgeColor(ageMs: number, scale: SeverityScale = AGE_SCALE): ColorScaleClass {
  return mapSeverity(ageMs, scale)
}

/**
 * Format a date/time with a locale-aware `Intl.DateTimeFormat`.
 *
 * Defaults to a medium date and short time when no options are given. Exact
 * output depends on the host locale data and time zone.
 *
 * @param input - The date to format, as a `Date` or epoch milliseconds.
 * @param options - Optional `Intl.DateTimeFormatOptions`. Defaults to `{ dateStyle: 'medium', timeStyle: 'short' }`.
 * @param locale - BCP-47 locale tag. Defaults to `'en-US'`.
 * @returns The formatted date/time string.
 *
 * @example
 * formatDateTime(new Date('2026-06-26T15:30:00Z'))
 * // → 'Jun 26, 2026, 3:30 PM' (UTC; varies by time zone)
 */
export function formatDateTime(input: Date | number, options?: Intl.DateTimeFormatOptions, locale?: string): string {
  return new Intl.DateTimeFormat(
    locale ?? DEFAULT_LOCALE,
    options ?? {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(input)
}
