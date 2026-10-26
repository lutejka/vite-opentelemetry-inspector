import { describe, expect, it } from 'vitest'
import type { Metric } from '../../src/types'
import {
  aggregateSamples,
  breakdownKeys,
  breakdownSeries,
  filterMetricGroups,
  groupMetrics,
  histogramBars,
  latestSeries,
  mergeHistograms,
  metricPointValue,
  metricSamples,
  metricSeriesCount,
  metricStats,
  sampleStats,
} from './metrics'

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

describe('metricSamples', () => {
  it('returns chronological non-null values paired with their timestamps', () => {
    expect(metricSamples([
      m({
        timestamp: 40,
        type: 'histogram',
        histogram: { buckets: [], sum: 100, count: 4, min: 1, max: 9 },
      }),
      m({ timestamp: 30, value: 3 }),
      m({ timestamp: 20, type: 'histogram' }),
      m({ timestamp: 10, value: 1 }),
    ])).toEqual([
      { value: 1, timestamp: 10 },
      { value: 3, timestamp: 30 },
      { value: 25, timestamp: 40 },
    ])
  })

  it('returns [] for no data points', () => {
    expect(metricSamples([])).toEqual([])
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

  it('aggregates same-timestamp series and exposes the series count', () => {
    const groups = groupMetrics([
      m({ metric_id: 'a1', timestamp: 100, service_name: 'demo', type: 'counter', value: 1, attributes: { method: 'GET' } }),
      m({ metric_id: 'a2', timestamp: 100, service_name: 'demo', type: 'counter', value: 2, attributes: { method: 'POST' } }),
      m({ metric_id: 'a3', timestamp: 200, service_name: 'demo', type: 'counter', value: 3, attributes: { method: 'GET' } }),
      m({ metric_id: 'a4', timestamp: 200, service_name: 'demo', type: 'counter', value: 4, attributes: { method: 'POST' } }),
    ])
    expect(groups[0]!.samples).toEqual([
      { timestamp: 100, value: 3 },
      { timestamp: 200, value: 7 },
    ])
    expect(groups[0]!.latestValue).toBe(7)
    expect(groups[0]!.sparklineValues).toEqual([3, 7])
    expect(groups[0]!.seriesCount).toBe(2)
  })

  it('merges histograms reported at the newest timestamp', () => {
    const groups = groupMetrics([
      m({ timestamp: 100, type: 'histogram', attributes: { route: '/a' }, histogram: { buckets: [{ bound: 10, count: 1 }], sum: 10, count: 1, min: 10, max: 10 } }),
      m({ timestamp: 100, type: 'histogram', attributes: { route: '/b' }, histogram: { buckets: [{ bound: 10, count: 2 }, { bound: 50, count: 1 }], sum: 70, count: 3, min: 5, max: 60 } }),
      m({ timestamp: 50, type: 'histogram', histogram: { buckets: [{ bound: 10, count: 9 }], sum: 90, count: 9, min: 1, max: 9 } }),
    ])
    expect(groups[0]!.latestHistogram).toEqual({
      buckets: [{ bound: 10, count: 3 }, { bound: 50, count: 1 }],
      sum: 80,
      count: 4,
      min: 5,
      max: 60,
    })
    expect(groups[0]!.latestValue).toBe(20)
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

describe('aggregateSamples', () => {
  it('sums counters that share a timestamp and sorts timestamps ascending', () => {
    expect(aggregateSamples([
      m({ timestamp: 20, type: 'counter', value: 4 }),
      m({ timestamp: 10, type: 'counter', value: 2 }),
      m({ timestamp: 10, type: 'counter', value: 3 }),
    ])).toEqual([
      { timestamp: 10, value: 5 },
      { timestamp: 20, value: 4 },
    ])
  })

  it('averages gauges that share a timestamp', () => {
    expect(aggregateSamples([
      m({ timestamp: 10, type: 'gauge', value: 10 }),
      m({ timestamp: 10, type: 'gauge', value: 20 }),
      m({ timestamp: 20, type: 'gauge', value: 30 }),
    ])).toEqual([
      { timestamp: 10, value: 15 },
      { timestamp: 20, value: 30 },
    ])
  })

  it('combines histograms with a count-weighted mean', () => {
    expect(aggregateSamples([
      m({ timestamp: 10, type: 'histogram', histogram: { buckets: [], sum: 100, count: 4, min: 1, max: 40 } }),
      m({ timestamp: 10, type: 'histogram', histogram: { buckets: [], sum: 300, count: 6, min: 2, max: 90 } }),
    ])).toEqual([{ timestamp: 10, value: 40 }])
  })

  it('ignores null values and zero-count histograms', () => {
    expect(aggregateSamples([
      m({ timestamp: 10, type: 'gauge', value: null }),
      m({ timestamp: 10, type: 'histogram', histogram: { buckets: [], sum: 0, count: 0, min: 0, max: 0 } }),
    ])).toEqual([])
    expect(aggregateSamples([
      m({ timestamp: 10, type: 'gauge', value: null }),
      m({ timestamp: 10, type: 'gauge', value: 8 }),
    ])).toEqual([{ timestamp: 10, value: 8 }])
  })
})

describe('sampleStats', () => {
  it('computes min/max/avg over sample values and null for none', () => {
    expect(sampleStats([{ timestamp: 1, value: 10 }, { timestamp: 2, value: 30 }]))
      .toEqual({ min: 10, max: 30, avg: 20 })
    expect(sampleStats([])).toBeNull()
  })
})

describe('mergeHistograms', () => {
  it('merges bucket counts by bound and sums sum/count/min/max', () => {
    expect(mergeHistograms([
      { buckets: [{ bound: 10, count: 2 }, { bound: 50, count: 1 }], sum: 30, count: 3, min: 1, max: 40 },
      { buckets: [{ bound: 10, count: 1 }, { bound: 100, count: 4 }], sum: 60, count: 5, min: 2, max: 90 },
    ])).toEqual({
      buckets: [{ bound: 10, count: 3 }, { bound: 50, count: 1 }, { bound: 100, count: 4 }],
      sum: 90,
      count: 8,
      min: 1,
      max: 90,
    })
  })

  it('returns null for empty input and handles no overlapping bounds', () => {
    expect(mergeHistograms([])).toBeNull()
    expect(mergeHistograms([
      { buckets: [], sum: 0, count: 0, min: 0, max: 0 },
    ])).toEqual({ buckets: [], sum: 0, count: 0, min: 0, max: 0 })
  })
})

describe('breakdownKeys', () => {
  it('lists sorted attribute keys with at least two distinct values', () => {
    expect(breakdownKeys([
      m({ attributes: { route: '/', method: 'GET' } }),
      m({ attributes: { route: '/x', method: 'GET' } }),
    ])).toEqual(['route'])
  })
})

describe('breakdownSeries', () => {
  const points = [
    m({ timestamp: 20, type: 'counter', value: 3, attributes: { method: 'GET' } }),
    m({ timestamp: 10, type: 'counter', value: 1, attributes: { method: 'GET' } }),
    m({ timestamp: 20, type: 'counter', value: 4, attributes: { method: 'POST' } }),
    m({ timestamp: 10, type: 'counter', value: 2, attributes: { method: 'POST' } }),
    m({ timestamp: 30, type: 'counter', value: 5 }),
  ]

  it('returns one aggregated series for null', () => {
    expect(breakdownSeries(points, null)).toEqual([
      { key: '', label: '', samples: [
        { timestamp: 10, value: 3 },
        { timestamp: 20, value: 7 },
        { timestamp: 30, value: 5 },
      ] },
    ])
  })

  it('splits by attribute value, sorts by label, and groups missing values as (none)', () => {
    expect(breakdownSeries(points, 'method')).toEqual([
      { key: '(none)', label: 'method=(none)', samples: [{ timestamp: 30, value: 5 }] },
      { key: 'GET', label: 'method=GET', samples: [{ timestamp: 10, value: 1 }, { timestamp: 20, value: 3 }] },
      { key: 'POST', label: 'method=POST', samples: [{ timestamp: 10, value: 2 }, { timestamp: 20, value: 4 }] },
    ])
  })

  it('distinguishes an empty attribute value from a missing one', () => {
    const series = breakdownSeries([
      m({ timestamp: 10, value: 1, attributes: { route: '' } }),
      m({ timestamp: 10, value: 2, attributes: {} }),
    ], 'route')
    expect(series.map(entry => [entry.key, entry.label])).toEqual([
      ['(empty)', 'route=(empty)'],
      ['(none)', 'route=(none)'],
    ])
  })
})

describe('metricSeriesCount', () => {
  it('counts distinct service + attribute combinations', () => {
    expect(metricSeriesCount([
      m({ service_name: 'a', attributes: { route: '/' } }),
      m({ service_name: 'a', attributes: { route: '/' } }),
      m({ service_name: 'a', attributes: { route: '/x' } }),
      m({ service_name: 'b', attributes: { route: '/' } }),
    ])).toBe(3)
  })
})

describe('latestSeries', () => {
  it('returns the latest value and history per series, sorted by label', () => {
    expect(latestSeries([
      m({ timestamp: 10, service_name: 'demo', value: 1, attributes: { space: 'old' } }),
      m({ timestamp: 20, service_name: 'demo', value: 3, attributes: { space: 'old' } }),
      m({ timestamp: 10, service_name: 'demo', value: 2, attributes: { space: 'new' } }),
      m({ timestamp: 20, service_name: 'demo', value: 4, attributes: { space: 'new' } }),
    ])).toEqual([
      {
        key: '["demo",[["space","new"]]]',
        label: 'space=new',
        value: 4,
        values: [2, 4],
        samples: [{ timestamp: 10, value: 2 }, { timestamp: 20, value: 4 }],
      },
      {
        key: '["demo",[["space","old"]]]',
        label: 'space=old',
        value: 3,
        values: [1, 3],
        samples: [{ timestamp: 10, value: 1 }, { timestamp: 20, value: 3 }],
      },
    ])
  })

  it('labels an attribute-free series with its service name', () => {
    expect(latestSeries([
      m({ timestamp: 10, service_name: 'demo', value: 7 }),
    ]).map(series => series.label)).toEqual(['demo'])
  })

  it('does not repeat the service name for attribute-free series from different services', () => {
    expect(latestSeries([
      m({ timestamp: 10, service_name: 'a', value: 1 }),
      m({ timestamp: 10, service_name: 'b', value: 2 }),
    ]).map(series => series.label)).toEqual(['a', 'b'])
  })
})
