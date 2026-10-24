import { describe, expect, it } from 'vitest'
import { ingestOtlpBody } from '../src/otel/ingest.ts'
import { createOtelStore } from '../src/store.ts'

const nano = (ms: number) => String(Math.round(ms * 1_000_000))

// Mirrors the shapes sent by examples/vite-devtools/main.ts.
function span(
  traceId: string,
  spanId: string,
  name: string,
  kind: number,
  start: number,
  duration: number,
  extra: Record<string, unknown> = {},
) {
  return {
    traceId,
    spanId,
    name,
    kind: kind + 1,
    startTimeUnixNano: nano(start),
    endTimeUnixNano: nano(start + duration),
    ...extra,
  }
}

describe('example seed payload', () => {
  it('ingests multiple traces, spans and logs', () => {
    const now = Date.now()
    const store = createOtelStore()
    ingestOtlpBody(store, {
      resourceSpans: [
        {
          resource: { attributes: [{ key: 'service.name', value: { stringValue: 'demo' } }] },
          scopeSpans: [{
            spans: [
              span('t1', 'root', 'GET /api/checkout', 1, now - 420, 420),
              span('t1', 'child', 'process-payment', 0, now - 380, 260, {
                parentSpanId: 'root',
                status: { code: 2, message: 'card declined' },
                events: [{ timeUnixNano: nano(now - 130), name: 'exception' }],
              }),
              span('t2', 'other', 'GET /api/search', 1, now - 900, 310),
            ],
          }],
        },
      ],
      resourceLogs: [
        {
          resource: { attributes: [{ key: 'service.name', value: { stringValue: 'demo' } }] },
          scopeLogs: [{
            logRecords: [
              {
                timeUnixNano: nano(now - 200),
                severityNumber: 17,
                severityText: 'ERROR',
                body: { stringValue: 'boom' },
                traceId: 't1',
                spanId: 'child',
              },
              { timeUnixNano: nano(now - 60), severityNumber: 9, severityText: 'INFO', body: { stringValue: 'ok' } },
            ],
          }],
        },
      ],
    })

    expect(store.getTraces()).toHaveLength(2)
    expect(store.getSpans()).toHaveLength(3)
    expect(store.getLogs()).toHaveLength(2)

    const err = store.getTraces().find(t => t.trace_id === 't1')!
    expect(err.status_code).toBe(2)
    expect(err.status_message).toBe('card declined')
    expect(err.operation_name).toBe('GET /api/checkout')

    const child = store.getSpans('t1').find(s => s.span_id === 'child')!
    expect(child.kind).toBe(0)
    expect(child.events).toHaveLength(1)

    // Stable IDs make reseeds idempotent for traces/spans.
    ingestOtlpBody(store, {
      resourceSpans: [
        {
          resource: { attributes: [{ key: 'service.name', value: { stringValue: 'demo' } }] },
          scopeSpans: [{ spans: [span('t1', 'root', 'GET /api/checkout', 1, now - 420, 420)] }],
        },
      ],
      resourceLogs: [],
    })
    expect(store.getTraces()).toHaveLength(2)
    expect(store.getSpans()).toHaveLength(3)
  })
})
