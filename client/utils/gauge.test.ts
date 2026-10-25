import { describe, expect, it } from 'vitest'
import {
  gaugeArcPath,
  gaugeFraction,
  gaugeValueOutsideScale,
  observedGaugeScale,
  resolveGaugeScale,
  sanitizeGaugeScales,
} from './gauge'

describe('observedGaugeScale', () => {
  it('returns the finite min and max of the series', () => {
    expect(observedGaugeScale([3, -2, 8, Number.NaN, Number.POSITIVE_INFINITY])).toEqual({ min: -2, max: 8 })
  })

  it('returns null when the series has no finite values', () => {
    expect(observedGaugeScale([])).toBeNull()
    expect(observedGaugeScale([Number.NaN, Number.NEGATIVE_INFINITY])).toBeNull()
  })

  it('pads a flat series so the needle has room to move', () => {
    expect(observedGaugeScale([10])).toEqual({ min: 9, max: 11 })
    expect(observedGaugeScale([0, 0])).toEqual({ min: -1, max: 1 })
  })
})

describe('resolveGaugeScale', () => {
  it('uses a valid override before the observed range', () => {
    expect(resolveGaugeScale([10, 20], { min: 0, max: 100 })).toEqual({ min: 0, max: 100 })
  })

  it('ignores invalid overrides and falls back to the observed range', () => {
    expect(resolveGaugeScale([10, 20], { min: 20, max: 10 })).toEqual({ min: 10, max: 20 })
    expect(resolveGaugeScale([10, 20], { min: Number.NaN, max: 30 })).toEqual({ min: 10, max: 20 })
  })

  it('uses a safe fallback when neither data nor an override exists', () => {
    expect(resolveGaugeScale([])).toEqual({ min: 0, max: 1 })
  })
})

describe('gaugeFraction', () => {
  const scale = { min: 10, max: 20 }

  it('maps a value onto the 0–1 arc and clamps outside the scale', () => {
    expect(gaugeFraction(10, scale)).toBe(0)
    expect(gaugeFraction(15, scale)).toBe(0.5)
    expect(gaugeFraction(20, scale)).toBe(1)
    expect(gaugeFraction(5, scale)).toBe(0)
    expect(gaugeFraction(25, scale)).toBe(1)
  })

  it('returns zero for missing or non-finite values', () => {
    expect(gaugeFraction(null, scale)).toBe(0)
    expect(gaugeFraction(Number.NaN, scale)).toBe(0)
  })
})

describe('gaugeValueOutsideScale', () => {
  const scale = { min: 10, max: 20 }

  it('reports values outside the scale only', () => {
    expect(gaugeValueOutsideScale(9, scale)).toBe(true)
    expect(gaugeValueOutsideScale(21, scale)).toBe(true)
    expect(gaugeValueOutsideScale(10, scale)).toBe(false)
    expect(gaugeValueOutsideScale(20, scale)).toBe(false)
    expect(gaugeValueOutsideScale(null, scale)).toBe(false)
  })
})

describe('gaugeArcPath', () => {
  it('draws the full semicircle from left to right', () => {
    expect(gaugeArcPath(100, 100, 50, 0, 1)).toBe('M 50 100 A 50 50 0 0 1 150 100')
  })

  it('draws a partial arc to the top', () => {
    expect(gaugeArcPath(100, 100, 50, 0, 0.5)).toBe('M 50 100 A 50 50 0 0 1 100 50')
  })
})

describe('sanitizeGaugeScales', () => {
  it('keeps only finite, ascending scales', () => {
    expect(sanitizeGaugeScales({
      good: { min: 0, max: 100 },
      reversed: { min: 10, max: 1 },
      text: { min: '0', max: '100' },
      missing: { min: 0 },
    })).toEqual({ good: { min: 0, max: 100 } })
  })

  it('returns an empty object for non-record input', () => {
    expect(sanitizeGaugeScales(null)).toEqual({})
    expect(sanitizeGaugeScales([])).toEqual({})
    expect(sanitizeGaugeScales('scale')).toEqual({})
  })
})
