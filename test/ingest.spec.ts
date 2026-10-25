import { describe, expect, it } from 'vitest'
import { ingestOtlpBody, matchesIngestPath } from '../src/otel/ingest.ts'
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

describe('matchesIngestPath', () => {
  const ingestPath = '/__opentelemetry-ingest'

  it('matches the endpoint itself', () => {
    expect(matchesIngestPath('/__opentelemetry-ingest', ingestPath)).toBe(true)
  })

  it('matches OTLP per-signal sub-paths', () => {
    expect(matchesIngestPath('/__opentelemetry-ingest/v1/traces', ingestPath)).toBe(true)
    expect(matchesIngestPath('/__opentelemetry-ingest/v1/logs', ingestPath)).toBe(true)
    expect(matchesIngestPath('/__opentelemetry-ingest/v1/metrics', ingestPath)).toBe(true)
  })

  it('matches sub-paths for a custom ingest path', () => {
    expect(matchesIngestPath('/__otel/v1/metrics', '/__otel')).toBe(true)
    expect(matchesIngestPath('/__otel', '/__otel')).toBe(true)
  })

  it('tolerates a trailing slash in the configured path', () => {
    expect(matchesIngestPath('/__otel', '/__otel/')).toBe(true)
    expect(matchesIngestPath('/__otel/v1/logs', '/__otel/')).toBe(true)
  })

  it('rejects look-alike prefixes', () => {
    expect(matchesIngestPath('/__opentelemetry-ingest-other', ingestPath)).toBe(false)
    expect(matchesIngestPath('/__opentelemetry-ingestx/v1/traces', ingestPath)).toBe(false)
  })

  it('rejects unrelated paths', () => {
    expect(matchesIngestPath('/', ingestPath)).toBe(false)
    expect(matchesIngestPath('/v1/traces', ingestPath)).toBe(false)
    expect(matchesIngestPath('', ingestPath)).toBe(false)
  })

  it('does not turn a root ingest path into a catch-all', () => {
    expect(matchesIngestPath('/', '/')).toBe(true)
    expect(matchesIngestPath('/app', '/')).toBe(false)
  })
})
