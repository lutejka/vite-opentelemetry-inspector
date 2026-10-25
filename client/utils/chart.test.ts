import { describe, expect, it } from 'vitest'
import { areaPath, chartPoints, niceValueTicks, polylinePath, sparklinePath } from './chart'

describe('sparklinePath', () => {
  it('normalizes min to 1 and max to 0 across len-1 width', () => {
    expect(sparklinePath([0, 5, 10])).toBe('0,1 1,0.5 2,0')
  })
  it('maps a flat range to a straight line at y=1', () => {
    expect(sparklinePath([4, 4, 4])).toBe('0,1 1,1 2,1')
  })
  it('returns "" for < 2 values', () => {
    expect(sparklinePath([1])).toBe('')
    expect(sparklinePath([])).toBe('')
  })
})

describe('niceValueTicks', () => {
  it('covers the domain with 1/2/5 steps', () => {
    const ticks = niceValueTicks(0, 100)
    expect(ticks[0]).toBeLessThanOrEqual(0)
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(100)
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]!)
    expect(new Set(gaps).size).toBe(1)
    expect(gaps[0]).toBeGreaterThan(0)
  })
  it('returns [min] for a flat domain and [] for empty input', () => {
    expect(niceValueTicks(5, 5)).toEqual([5])
    expect(niceValueTicks(Number.NaN, 1)).toEqual([])
  })
})

describe('chartPoints', () => {
  it('maps the domain into the pixel box with y inverted', () => {
    const pts = chartPoints([{ x: 0, y: 0 }, { x: 10, y: 100 }], 100, 50)
    expect(pts).toEqual([{ x: 0, y: 50 }, { x: 100, y: 0 }])
  })
  it('handles single points and flat domains without NaN', () => {
    expect(chartPoints([{ x: 5, y: 5 }], 100, 50)).toEqual([{ x: 50, y: 25 }])
    const flat = chartPoints([{ x: 0, y: 7 }, { x: 4, y: 7 }], 100, 50)
    expect(flat).toEqual([{ x: 0, y: 25 }, { x: 100, y: 25 }])
    expect(flat.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
  it('returns [] for empty input', () => {
    expect(chartPoints([], 100, 50)).toEqual([])
  })
})

describe('paths', () => {
  it('builds rounded move/line commands', () => {
    expect(polylinePath([{ x: 0, y: 1.234 }, { x: 2, y: 3 }])).toBe('M 0 1.23 L 2 3')
    expect(areaPath([{ x: 0, y: 0 }, { x: 2, y: 3 }], 50)).toBe('M 0 0 L 2 3 L 2 50 L 0 50 Z')
    expect(polylinePath([])).toBe('')
    expect(areaPath([{ x: 1, y: 1 }], 50)).toBe('')
  })
})
