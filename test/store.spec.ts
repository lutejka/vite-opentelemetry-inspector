import { describe, expect, it } from 'vitest'
import { ingestOtlpBody } from '../src/otel/ingest'
import { createOtelStore } from '../src/store'
import type { Metric } from '../src/types'

function metric(i: number): Metric {
  return {
    metric_id: `m${i}`,
    name: 'test.metric',
    description: null,
    unit: null,
    type: 'gauge',
    service_name: 'demo',
    timestamp: i,
    value: i,
    histogram: null,
    attributes: {},
  }
}

function traceBody() {
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'demo' } }] },
        scopeSpans: [
          {
            spans: [
              {
                traceId: 'abc',
                spanId: 'span-1',
                name: 'GET /',
                kind: 2,
                startTimeUnixNano: '1000000000',
                endTimeUnixNano: '1005000000',
                status: {},
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('otel store', () => {
  it('dedupes spans and traces', () => {
    const store = createOtelStore()
    ingestOtlpBody(store, traceBody())
    ingestOtlpBody(store, traceBody())
    expect(store.getTraces()).toHaveLength(1)
    expect(store.getSpans()).toHaveLength(1)
    expect(store.getSpans('abc')).toHaveLength(1)
    expect(store.getTrace('abc').trace?.operation_name).toBe('GET /')
  })

  it('clears traces and spans together', () => {
    const store = createOtelStore()
    ingestOtlpBody(store, traceBody())
    store.clearTraces()
    expect(store.getTraces()).toHaveLength(0)
    expect(store.getSpans()).toHaveLength(0)
  })

  it('caps metrics at the last 1000 data points', () => {
    const store = createOtelStore()
    store.addMetrics(Array.from({ length: 1005 }, (_, i) => metric(i)))
    const all = store.getMetrics()
    expect(all).toHaveLength(1000)
    expect(all[0]!.metric_id).toBe('m5')
    expect(all.at(-1)!.metric_id).toBe('m1004')
  })

  it('clearMetrics leaves traces/logs alone and clearTraces leaves metrics alone', () => {
    const store = createOtelStore()
    ingestOtlpBody(store, traceBody())
    store.addMetrics([metric(1)])
    store.clearTraces()
    expect(store.getMetrics()).toHaveLength(1)
    store.clearMetrics()
    expect(store.getMetrics()).toHaveLength(0)
  })
})
