import { describe, expect, it } from 'vitest'
import { easeOutCubic, sameLayout, tweenPoints } from './animation'

describe('easeOutCubic', () => {
  it('starts at 0, ends at 1 and decelerates', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })

  it('clamps progress outside 0..1', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })
})

describe('tweenPoints', () => {
  const from = [
    { key: 1, x: 0, y: 10, time: 'a' },
    { key: 2, x: 10, y: 20, time: 'b' },
  ]
  const to = [
    { key: 1, x: 0, y: 0, time: 'a' },
    { key: 2, x: 5, y: 10, time: 'b' },
    { key: 3, x: 10, y: 20, time: 'c' },
  ]

  it('interpolates points shared by key and keeps new points at their target', () => {
    expect(tweenPoints(from, to, 0.5)).toEqual([
      { key: 1, x: 0, y: 5, time: 'a' },
      { key: 2, x: 7.5, y: 15, time: 'b' },
      { key: 3, x: 10, y: 20, time: 'c' },
    ])
  })

  it('uses the previous layout at progress 0 with the target metadata', () => {
    expect(tweenPoints(from, to, 0)).toEqual([
      { key: 1, x: 0, y: 10, time: 'a' },
      { key: 2, x: 10, y: 20, time: 'b' },
      { key: 3, x: 10, y: 20, time: 'c' },
    ])
  })

  it('uses the target layout at progress 1', () => {
    expect(tweenPoints(from, to, 1)).toEqual(to)
  })

  it('drops points that are no longer in the target', () => {
    expect(tweenPoints(to, from, 0.5).map(point => point.key)).toEqual([1, 2])
  })

  it('clamps progress outside 0..1', () => {
    expect(tweenPoints(from, to, -1)).toEqual(tweenPoints(from, to, 0))
    expect(tweenPoints(from, to, 2)).toEqual(tweenPoints(from, to, 1))
  })

  it('handles empty input', () => {
    expect(tweenPoints([], [], 0.5)).toEqual([])
    expect(tweenPoints([], to, 0.5)).toEqual(to)
    expect(tweenPoints(from, [], 0.5)).toEqual([])
  })

  it('supports string keys for multi-series layouts', () => {
    const fromSeries = [{ key: 'a:1', x: 0, y: 10 }, { key: 'b:1', x: 0, y: 20 }]
    const toSeries = [{ key: 'a:1', x: 5, y: 0 }, { key: 'b:1', x: 5, y: 30 }]
    expect(tweenPoints(fromSeries, toSeries, 0.5)).toEqual([
      { key: 'a:1', x: 2.5, y: 5 },
      { key: 'b:1', x: 2.5, y: 25 },
    ])
    expect(sameLayout(toSeries, toSeries)).toBe(true)
  })
})

describe('sameLayout', () => {
  const points = [
    { key: 1, x: 0, y: 10, time: 'a' },
    { key: 2, x: 5, y: 20, time: 'b' },
  ]

  it('matches keys and positions while ignoring metadata', () => {
    expect(sameLayout(points, points)).toBe(true)
    expect(sameLayout(points, points.map(point => ({ ...point, time: 'later' })))).toBe(true)
    expect(sameLayout(points, [{ ...points[0]!, x: 1 }, points[1]!])).toBe(false)
    expect(sameLayout(points, [{ ...points[0]!, y: 11 }, points[1]!])).toBe(false)
  })

  it('returns false when the point count differs', () => {
    expect(sameLayout(points, points.slice(1))).toBe(false)
    expect(sameLayout(points, [...points, { key: 3, x: 10, y: 30 }])).toBe(false)
  })

  it('returns true for empty input', () => {
    expect(sameLayout([], [])).toBe(true)
  })
})
