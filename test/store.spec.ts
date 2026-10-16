import { describe, expect, it } from 'vitest'
import { ingestOtlpBody } from '../src/otel/ingest'
import { createOtelStore } from '../src/store'

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
})
