import { describe, expect, it } from 'vitest'
import type { Metric } from '../../src/types'
import { filterMetricGroups, groupMetrics, histogramBars, metricPointValue, metricStats } from './metrics'

function m(overrides: Partial<Metric>): Metric {
  return {
    metric_id: overrides.timestamp?.toString() ?? 'id',
    name: 'test',
    description: null,
    unit: null,
    type: 'gauge',
    service_name: 'demo',
    timestamp: 0,
    value: null,
    histogram: null,
    attributes: {},
    ...overrides,
  }
}

describe('metricPointValue', () => {
  it('returns value for counters/gauges and sum/count for histograms', () => {
    expect(metricPointValue(m({ type: 'counter', value: 7 }))).toBe(7)
    expect(metricPointValue(m({
      type: 'histogram',
      histogram: { buckets: [], sum: 2400, count: 20, min: 4, max: 480 },
    }))).toBe(120)
  })

  it('returns null for zero-count and missing histograms', () => {
    expect(metricPointValue(m({ type: 'histogram', histogram: { buckets: [], sum: 0, count: 0, min: 0, max: 0 } })))
      .toBeNull()
    expect(metricPointValue(m({ type: 'histogram' }))).toBeNull()
  })
})

describe('groupMetrics', () => {
  it('groups by name, newest first, latestValue from newest point', () => {
    const groups = groupMetrics([
      m({ metric_id: 'a', name: 'b.metric', timestamp: 100, value: 1 }),
      m({ metric_id: 'b', name: 'a.metric', timestamp: 300, value: 3, unit: 'ms' }),
      m({ metric_id: 'c', name: 'b.metric', timestamp: 200, value: 2 }),
    ])
    expect(groups.map(g => g.name)).toEqual(['a.metric', 'b.metric'])
    const b = groups[1]!
    expect(b.latestValue).toBe(2)
    expect(b.unit).toBeNull()
    expect(b.dataPoints.map(p => p.timestamp)).toEqual([200, 100])
    expect(b.sparklineValues).toEqual([1, 2])
  })

  it('takes type/description/unit from the newest record and averages histograms', () => {
    const groups = groupMetrics([
      m({ name: 'h', timestamp: 100, type: 'counter', value: 1 }),
      m({
        name: 'h',
        timestamp: 200,
        type: 'histogram',
        unit: 'ms',
        description: 'dur',
        histogram: { buckets: [], sum: 100, count: 4, min: 1, max: 50 },
      }),
    ])
    expect(groups[0]!.type).toBe('histogram')
    expect(groups[0]!.unit).toBe('ms')
    expect(groups[0]!.description).toBe('dur')
    expect(groups[0]!.latestValue).toBe(25)
    expect(groups[0]!.latestHistogram).toEqual({ buckets: [], sum: 100, count: 4, min: 1, max: 50 })
    expect(groups[0]!.sparklineValues).toEqual([1, 25])
  })

  it('returns [] for no metrics', () => {
    expect(groupMetrics([])).toEqual([])
  })
})

describe('metricStats', () => {
  it('computes min/max/avg over non-null values and null for none', () => {
    const stats = metricStats([
      m({ timestamp: 1, value: 10 }),
      m({ timestamp: 2, value: 30 }),
      m({ timestamp: 3, type: 'histogram' }),
    ])
    expect(stats).toEqual({ min: 10, max: 30, avg: 20 })
    expect(metricStats([m({ type: 'histogram' })])).toBeNull()
    expect(metricStats([])).toBeNull()
  })
})

describe('filterMetricGroups', () => {
  const groups = groupMetrics([
    m({ name: 'process.memory.heap', type: 'gauge', timestamp: 1, value: 10 }),
    m({ name: 'http.requests.total', type: 'counter', timestamp: 2, value: 3 }),
    m({
      name: 'http.server.duration',
      type: 'histogram',
      timestamp: 3,
      histogram: { buckets: [], sum: 10, count: 2, min: 1, max: 9 },
    }),
  ])

  it('filters by metric type', () => {
    expect(filterMetricGroups(groups, '', 'gauge').map(g => g.name)).toEqual(['process.memory.heap'])
    expect(filterMetricGroups(groups, '', 'counter').map(g => g.name)).toEqual(['http.requests.total'])
    expect(filterMetricGroups(groups, '', 'histogram').map(g => g.name)).toEqual(['http.server.duration'])
  })

  it('matches the query case-insensitively and trims it', () => {
    expect(filterMetricGroups(groups, '  MEMORY ', 'all').map(g => g.name)).toEqual(['process.memory.heap'])
    expect(filterMetricGroups(groups, '   ', 'all')).toEqual(groups)
  })

  it('combines the type and query filters', () => {
    expect(filterMetricGroups(groups, 'http', 'all').map(g => g.name)).toEqual([
      'http.requests.total',
      'http.server.duration',
    ])
    expect(filterMetricGroups(groups, 'http', 'gauge')).toEqual([])
  })
})

describe('histogramBars', () => {
  const buckets = [
    { bound: 10, count: 2 },
    { bound: 50, count: 6 },
    { bound: 100, count: 5 },
    { bound: 500, count: 3 },
  ]

  it('turns ascending bounds into ranges and appends the implied overflow bucket', () => {
    expect(histogramBars({ buckets, sum: 2400, count: 20, min: 4, max: 480 })).toEqual([
      { from: null, to: 10, count: 2 },
      { from: 10, to: 50, count: 6 },
      { from: 50, to: 100, count: 5 },
      { from: 100, to: 500, count: 3 },
      { from: 500, to: null, count: 4 },
    ])
  })

  it('omits overflow when the buckets already account for every sample', () => {
    expect(histogramBars({ buckets, sum: 2400, count: 16, min: 4, max: 480 })).toEqual([
      { from: null, to: 10, count: 2 },
      { from: 10, to: 50, count: 6 },
      { from: 50, to: 100, count: 5 },
      { from: 100, to: 500, count: 3 },
    ])
  })

  it('keeps empty buckets and returns [] when there are no bounds', () => {
    expect(histogramBars({
      buckets: [{ bound: 10, count: 0 }, { bound: 50, count: 0 }],
      sum: 0,
      count: 0,
      min: 0,
      max: 0,
    })).toEqual([
      { from: null, to: 10, count: 0 },
      { from: 10, to: 50, count: 0 },
    ])
    expect(histogramBars({ buckets: [], sum: 0, count: 0, min: 0, max: 0 })).toEqual([])
  })

  it('never emits a negative overflow from inconsistent counts', () => {
    expect(histogramBars({
      buckets: [{ bound: 10, count: 3 }, { bound: 20, count: 2 }],
      sum: 60,
      count: 2,
      min: 1,
      max: 15,
    })).toEqual([
      { from: null, to: 10, count: 3 },
      { from: 10, to: 20, count: 2 },
    ])
  })

  it('handles a single bound', () => {
    expect(histogramBars({ buckets: [{ bound: 25, count: 3 }], sum: 30, count: 5, min: 1, max: 40 }))
      .toEqual([
        { from: null, to: 25, count: 3 },
        { from: 25, to: null, count: 2 },
      ])
  })
})
