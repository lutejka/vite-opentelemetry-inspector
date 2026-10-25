import { describe, expect, it } from 'vitest'
import { ingestOtlpBody } from '../src/otel/ingest'
import { parseOTLPMetrics } from '../src/otel/parser'
import { createOtelStore } from '../src/store'

const nano = (ms: number) => String(Math.round(ms * 1_000_000))
const resource = { attributes: [{ key: 'service.name', value: { stringValue: 'demo' } }] }

function numberMetric(overrides: Record<string, unknown> = {}) {
  return {
    name: 'http.requests.total',
    unit: '1',
    description: 'Total requests',
    sum: {
      isMonotonic: true,
      aggregationTemporality: 2,
      dataPoints: [{ timeUnixNano: nano(1000), asInt: '42' }],
    },
    ...overrides,
  }
}

describe('parseOTLPMetrics', () => {
  it('parses monotonic sums as counters with string-encoded ints converted', () => {
    const { metrics } = parseOTLPMetrics({ resourceMetrics: [{ resource, scopeMetrics: [{ metrics: [numberMetric()] }] }] })
    expect(metrics).toHaveLength(1)
    const m = metrics[0]!
    expect(m.type).toBe('counter')
    expect(m.name).toBe('http.requests.total')
    expect(m.value).toBe(42)
    expect(typeof m.value).toBe('number')
    expect(m.unit).toBe('1')
    expect(m.description).toBe('Total requests')
    expect(m.service_name).toBe('demo')
    expect(m.timestamp).toBe(1000)
    expect(m.histogram).toBeNull()
    expect(m.metric_id).toBeTruthy()
  })

  it('parses non-monotonic sums as gauges and gauge datapoints as gauges', () => {
    const { metrics } = parseOTLPMetrics({
      resourceMetrics: [{
        resource,
        scopeMetrics: [{
          metrics: [
            numberMetric({ name: 'queue.size', sum: { isMonotonic: false, dataPoints: [{ timeUnixNano: nano(2000), asDouble: 3.5 }] } }),
            { name: 'cpu.load', gauge: { dataPoints: [{ timeUnixNano: nano(3000), asDouble: 0.75 }] } },
          ],
        }],
      }],
    })
    expect(metrics.map(m => [m.name, m.type, m.value])).toEqual([
      ['queue.size', 'gauge', 3.5],
      ['cpu.load', 'gauge', 0.75],
    ])
  })

  it('parses histograms with buckets, string-encoded fields, and defaults', () => {
    const { metrics } = parseOTLPMetrics({
      resourceMetrics: [{
        resource,
        scopeMetrics: [{
          metrics: [{
            name: 'http.server.duration',
            unit: 'ms',
            histogram: {
              dataPoints: [{
                timeUnixNano: nano(4000),
                count: '20',
                sum: '2400',
                min: '4',
                max: '480',
                explicitBounds: [10, 50, 100, 500],
                bucketCounts: ['1', '5', '9', '4', '1'],
                attributes: [{ key: 'http.route', value: { stringValue: '/api' } }],
              }],
            },
          }],
        }],
      }],
    })
    const m = metrics[0]!
    expect(m.type).toBe('histogram')
    expect(m.value).toBeNull()
    expect(m.histogram).toEqual({
      buckets: [
        { bound: 10, count: 1 },
        { bound: 50, count: 5 },
        { bound: 100, count: 9 },
        { bound: 500, count: 4 },
      ],
      sum: 2400,
      count: 20,
      min: 4,
      max: 480,
    })
    expect(m.attributes).toEqual({ 'http.route': '/api' })
  })

  it('defaults missing optional fields and ignores summaries/exponential histograms', () => {
    const { metrics } = parseOTLPMetrics({
      resourceMetrics: [{
        scopeMetrics: [{
          metrics: [
            { name: 'bare.gauge', gauge: { dataPoints: [{ timeUnixNano: nano(5000), asDouble: 1 }] } },
            { name: 'legacy.summary', summary: { dataPoints: [{ count: '3', sum: 9 }] } },
            { name: 'exp.hist', exponentialHistogram: { dataPoints: [{ timeUnixNano: nano(5000), count: '2' }] } },
            { name: 'no.value', gauge: { dataPoints: [{ timeUnixNano: nano(5000) }] } },
          ],
        }],
      }],
    })
    expect(metrics.map(m => m.name)).toEqual(['bare.gauge', 'no.value'])
    const bare = metrics[0]!
    expect(bare.service_name).toBe('unknown')
    expect(bare.description).toBeNull()
    expect(bare.unit).toBeNull()
    expect(bare.attributes).toEqual({})
    expect(metrics[1]!.value).toBeNull()
  })
})

describe('ingestOtlpBody metrics', () => {
  it('ingests resourceMetrics alone and merged with traces and logs', () => {
    const store = createOtelStore()
    const body = { resourceMetrics: [{ resource, scopeMetrics: [{ metrics: [numberMetric()] }] }] }
    ingestOtlpBody(store, body)
    expect(store.getMetrics()).toHaveLength(1)

    ingestOtlpBody(store, {
      ...body,
      resourceSpans: [{
        resource,
        scopeSpans: [{
          spans: [{
            traceId: 't1',
            spanId: 's1',
            name: 'GET /',
            kind: 2,
            startTimeUnixNano: nano(1000),
            endTimeUnixNano: nano(1500),
          }],
        }],
      }],
      resourceLogs: [{ resource, scopeLogs: [{ logRecords: [{ timeUnixNano: nano(1200), severityNumber: 9, body: { stringValue: 'hi' } }] }] }],
    })
    expect(store.getTraces()).toHaveLength(1)
    expect(store.getLogs()).toHaveLength(1)
    expect(store.getMetrics()).toHaveLength(2) // 1 from the first ingest + 1 from the merged body's resourceMetrics (random ids, no dedupe)
  })
})
