import { describe, expect, it } from 'vitest'
import { gaugeFraction, gaugeValueAtFraction, observedGaugeScale, resolveGaugeScale } from './gauge'

describe('observedGaugeScale', () => {
  it('returns the finite min and max of the series', () => {
    expect(observedGaugeScale([3, -2, 8, Number.NaN, Number.POSITIVE_INFINITY])).toEqual({ min: -2, max: 8 })
  })

  it('returns null when the series has no finite values', () => {
    expect(observedGaugeScale([])).toBeNull()
    expect(observedGaugeScale([Number.NaN, Number.NEGATIVE_INFINITY])).toBeNull()
  })

  it('pads a flat series so the marker has room to move', () => {
    expect(observedGaugeScale([10])).toEqual({ min: 9, max: 11 })
    expect(observedGaugeScale([0, 0])).toEqual({ min: -1, max: 1 })
  })
})

describe('resolveGaugeScale', () => {
  it('uses the observed range', () => {
    expect(resolveGaugeScale([10, 20])).toEqual({ min: 10, max: 20 })
  })

  it('uses a safe fallback when the series has no finite values', () => {
    expect(resolveGaugeScale([])).toEqual({ min: 0, max: 1 })
  })
})

describe('gaugeFraction', () => {
  const scale = { min: 10, max: 20 }

  it('maps a value onto the 0–1 track and clamps outside the scale', () => {
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

describe('gaugeValueAtFraction', () => {
  const scale = { min: 10, max: 20 }

  it('maps a 0–1 position onto the scale', () => {
    expect(gaugeValueAtFraction(scale, 0)).toBe(10)
    expect(gaugeValueAtFraction(scale, 0.25)).toBe(12.5)
    expect(gaugeValueAtFraction(scale, 1)).toBe(20)
  })

  it('clamps positions outside 0–1', () => {
    expect(gaugeValueAtFraction(scale, -1)).toBe(10)
    expect(gaugeValueAtFraction(scale, 2)).toBe(20)
    expect(gaugeValueAtFraction(scale, Number.NaN)).toBe(10)
  })

  it('returns the lower bound for an invalid scale', () => {
    expect(gaugeValueAtFraction({ min: 20, max: 10 }, 0.5)).toBe(20)
  })
})
