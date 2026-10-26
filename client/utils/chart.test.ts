import { describe, expect, it } from 'vitest'
import {
  areaPath,
  chartDomain,
  chartPoints,
  mapChartPoint,
  nearestPointIndex,
  niceValueTicks,
  pointAtX,
  polylinePath,
  sparklinePath,
} from './chart'

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

describe('nearestPointIndex', () => {
  const points = [{ x: 0, y: 0 }, { x: 10, y: 1 }, { x: 30, y: 2 }]

  it('returns the closest point by x in either direction', () => {
    expect(nearestPointIndex(points, 0)).toBe(0)
    expect(nearestPointIndex(points, 9)).toBe(1)
    expect(nearestPointIndex(points, 11)).toBe(1)
    expect(nearestPointIndex(points, 21)).toBe(2)
    expect(nearestPointIndex(points, 30)).toBe(2)
  })
  it('clamps beyond the ends', () => {
    expect(nearestPointIndex(points, -50)).toBe(0)
    expect(nearestPointIndex(points, 100)).toBe(2)
  })
  it('keeps the earlier point on a tie', () => {
    expect(nearestPointIndex(points, 20)).toBe(1)
  })
  it('returns 0 for empty input', () => {
    expect(nearestPointIndex([], 10)).toBe(0)
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

describe('chartDomain', () => {
  it('returns null for empty input and the exact bounds otherwise', () => {
    expect(chartDomain([])).toBeNull()
    expect(chartDomain([{ x: 1, y: 5 }, { x: 3, y: 9 }])).toEqual({ minX: 1, maxX: 3, minY: 5, maxY: 9 })
  })

  it('keeps degenerate domains degenerate', () => {
    expect(chartDomain([{ x: 4, y: 7 }])).toEqual({ minX: 4, maxX: 4, minY: 7, maxY: 7 })
  })
})

describe('mapChartPoint', () => {
  const domain = { minX: 0, maxX: 10, minY: 0, maxY: 100 }

  it('maps a custom domain into the pixel box with y inverted', () => {
    expect(mapChartPoint({ x: 0, y: 0 }, domain, 100, 50)).toEqual({ x: 0, y: 50 })
    expect(mapChartPoint({ x: 10, y: 100 }, domain, 100, 50)).toEqual({ x: 100, y: 0 })
  })

  it('centres degenerate axes and clamps outside the domain', () => {
    const flat = { minX: 5, maxX: 5, minY: 7, maxY: 7 }
    expect(mapChartPoint({ x: 5, y: 7 }, flat, 100, 50)).toEqual({ x: 50, y: 25 })
    expect(mapChartPoint({ x: -1, y: 200 }, domain, 100, 50)).toEqual({ x: 0, y: 0 })
  })
})

describe('pointAtX', () => {
  it('returns the exact sample or null', () => {
    const points = [{ x: 10, y: 1 }, { x: 20, y: 2 }]
    expect(pointAtX(points, 20)).toEqual({ x: 20, y: 2 })
    expect(pointAtX(points, 15)).toBeNull()
  })

  it('returns the first of duplicate x values', () => {
    const points = [{ x: 10, y: 1 }, { x: 10, y: 2 }]
    expect(pointAtX(points, 10)).toEqual({ x: 10, y: 1 })
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
