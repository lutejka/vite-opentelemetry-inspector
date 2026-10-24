import { describe, expect, it } from 'vitest'
import {
  AGE_SCALE,
  colorScale,
  DURATION_SCALE,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTimeAgo,
  getAgeColor,
  getDurationColor,
  mapSeverity,
} from './format'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const YEAR = 365 * DAY

describe('colorScale', () => {
  it('uses the exact color-scale-* class names the CSS utilities define', () => {
    expect(colorScale).toEqual({
      neutral: 'color-scale-neutral',
      low: 'color-scale-low',
      medium: 'color-scale-medium',
      high: 'color-scale-high',
      critical: 'color-scale-critical',
    })
  })
})

describe('mapSeverity', () => {
  const scale = [
    [50, colorScale.low],
    [200, colorScale.medium],
  ] as const

  it('returns the class of the first threshold the value does not exceed', () => {
    expect(mapSeverity(0, scale)).toBe('color-scale-low')
    expect(mapSeverity(50, scale)).toBe('color-scale-low')
    expect(mapSeverity(51, scale)).toBe('color-scale-medium')
    expect(mapSeverity(200, scale)).toBe('color-scale-medium')
  })

  it('returns the last class when the value is above every threshold', () => {
    expect(mapSeverity(201, scale)).toBe('color-scale-medium')
    expect(mapSeverity(999_999, scale)).toBe('color-scale-medium')
  })
})

describe('formatNumber', () => {
  it('groups digits for the default en-US locale', () => {
    expect(formatNumber(1_234_567)).toBe('1,234,567')
    expect(formatNumber(42)).toBe('42')
  })

  it('accepts an explicit locale', () => {
    expect(formatNumber(1_234_567, undefined, 'de-DE')).toBe('1.234.567')
  })

  it('accepts Intl.NumberFormatOptions', () => {
    expect(formatNumber(1234.5678, { maximumFractionDigits: 1 })).toBe('1,234.6')
  })
})

describe('formatDuration', () => {
  it('renders null/undefined as an empty value with a dash unit', () => {
    expect(formatDuration(null)).toEqual(['', '-'])
    expect(formatDuration(undefined)).toEqual(['', '-'])
  })

  it('keeps the backwards-compatible <1 ms case', () => {
    expect(formatDuration(0.5)).toEqual(['<1', 'ms'])
    expect(formatDuration(0)).toEqual(['<1', 'ms'])
  })

  it('formats millisecond input', () => {
    expect(formatDuration(1)).toEqual(['1', 'ms'])
    expect(formatDuration(250)).toEqual(['250', 'ms'])
    expect(formatDuration(999.6)).toEqual(['1000', 'ms'])
  })

  it('formats nanosecond input', () => {
    expect(formatDuration(500, { unit: 'ns' })).toEqual(['500', 'ns'])
    expect(formatDuration(1500, { unit: 'ns' })).toEqual(['1.5', 'µs'])
  })

  it('formats microsecond input', () => {
    expect(formatDuration(820, { unit: 'us' })).toEqual(['820', 'µs'])
    expect(formatDuration(0.5, { unit: 'us' })).toEqual(['500', 'ns'])
    // 1500 µs = 1.5 ms, which the source rounds to whole milliseconds
    expect(formatDuration(1500, { unit: 'us' })).toEqual(['2', 'ms'])
  })

  it('formats second input', () => {
    expect(formatDuration(2, { unit: 's' })).toEqual(['2.0', 's'])
    expect(formatDuration(0.25, { unit: 's' })).toEqual(['250', 'ms'])
  })

  it('runs the s → min → h → d ladder', () => {
    expect(formatDuration(1500)).toEqual(['1.5', 's'])
    expect(formatDuration(59_900)).toEqual(['59.9', 's'])
    expect(formatDuration(60_000)).toEqual(['1.0', 'min'])
    expect(formatDuration(3_600_000)).toEqual(['1.0', 'h'])
    expect(formatDuration(86_400_000)).toEqual(['1.0', 'd'])
  })
})

describe('getDurationColor', () => {
  it('classifies with the default duration thresholds', () => {
    expect(getDurationColor(0)).toBe('color-scale-neutral')
    expect(getDurationColor(50)).toBe('color-scale-neutral')
    expect(getDurationColor(51)).toBe('color-scale-low')
    expect(getDurationColor(200)).toBe('color-scale-low')
    expect(getDurationColor(201)).toBe('color-scale-medium')
    expect(getDurationColor(1000)).toBe('color-scale-medium')
    expect(getDurationColor(1001)).toBe('color-scale-high')
    expect(getDurationColor(5000)).toBe('color-scale-high')
    expect(getDurationColor(5001)).toBe('color-scale-critical')
  })

  it('accepts a custom scale', () => {
    expect(getDurationColor(10, [[5, colorScale.high]])).toBe('color-scale-high')
    expect(DURATION_SCALE.at(-1)?.[1]).toBe('color-scale-critical')
  })
})

describe('formatTimeAgo', () => {
  const now = 1_000_000_000_000

  it('renders sub-second deltas as "just now"', () => {
    expect(formatTimeAgo(now, now)).toBe('just now')
    expect(formatTimeAgo(now - 999, now)).toBe('just now')
  })

  it('renders past deltas as "N unit ago"', () => {
    expect(formatTimeAgo(now - 30 * SECOND, now)).toBe('30 s ago')
    expect(formatTimeAgo(now - 5 * MINUTE, now)).toBe('5 min ago')
    expect(formatTimeAgo(now - 2 * HOUR, now)).toBe('2 h ago')
    expect(formatTimeAgo(now - 3 * DAY, now)).toBe('3 d ago')
    expect(formatTimeAgo(now - 45 * DAY, now)).toBe('2 mo ago')
    expect(formatTimeAgo(now - 2 * YEAR, now)).toBe('2 y ago')
  })

  it('renders future deltas as "in N unit"', () => {
    expect(formatTimeAgo(now + 2 * HOUR, now)).toBe('in 2 h')
    expect(formatTimeAgo(now + 3 * DAY, now)).toBe('in 3 d')
  })

  it('accepts a Date input', () => {
    expect(formatTimeAgo(new Date(now - 3 * DAY), now)).toBe('3 d ago')
  })
})

describe('getAgeColor', () => {
  it('classifies with the default age thresholds', () => {
    expect(getAgeColor(0)).toBe('color-scale-neutral')
    expect(getAgeColor(180 * DAY)).toBe('color-scale-neutral')
    expect(getAgeColor(181 * DAY)).toBe('color-scale-low')
    expect(getAgeColor(365 * DAY)).toBe('color-scale-low')
    expect(getAgeColor(366 * DAY)).toBe('color-scale-medium')
    expect(getAgeColor(6 * YEAR)).toBe('color-scale-critical')
  })

  it('accepts a custom scale', () => {
    expect(getAgeColor(1, [[0, colorScale.critical]])).toBe('color-scale-critical')
    expect(AGE_SCALE.at(-1)?.[1]).toBe('color-scale-critical')
  })
})

describe('formatDateTime', () => {
  const input = new Date(Date.UTC(2026, 0, 2, 3, 4, 5))

  it('formats with explicit options and locale', () => {
    expect(formatDateTime(input, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }, 'en-US')).toBe('01/02/2026')
  })

  it('accepts epoch milliseconds', () => {
    expect(formatDateTime(input.getTime(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }, 'en-US')).toBe('01/02/2026')
  })

  it('defaults to a medium date and short time', () => {
    const output = formatDateTime(input, { timeZone: 'UTC' })
    expect(output).toContain('2026')
    expect(output.length).toBeGreaterThan(0)
  })
})
