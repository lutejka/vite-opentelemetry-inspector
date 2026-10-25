const now = Date.now()
const nano = (ms: number) => String(Math.round(ms * 1_000_000))

interface SpanSpec {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  /** Internal kind (0 = internal, 1 = server, 2 = client, 3 = producer, 4 = consumer). */
  kind: number
  offset: number
  duration: number
  status?: { code: number; message?: string }
  attributes?: Array<{ key: string; value: Record<string, unknown> }>
  events?: Array<{ at: number; name: string; attributes?: Array<{ key: string; value: Record<string, unknown> }> }>
}

function str(value: string) {
  return { stringValue: value }
}

function num(value: number) {
  return { intValue: value }
}

function buildSpans(baseStart: number, specs: SpanSpec[]) {
  return specs.map(s => ({
    traceId: s.traceId,
    spanId: s.spanId,
    ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
    name: s.name,
    // OTLP kinds are 1-based (UNSPECIFIED = 0); the parser maps them back.
    kind: s.kind + 1,
    startTimeUnixNano: nano(baseStart + s.offset),
    endTimeUnixNano: nano(baseStart + s.offset + s.duration),
    attributes: s.attributes ?? [],
    status: s.status ?? {},
    ...(s.events
      ? {
        events: s.events.map(e => ({
          timeUnixNano: nano(baseStart + s.offset + e.at),
          name: e.name,
          attributes: e.attributes ?? [],
        })),
      }
      : {}),
  }))
}

const T1 = '4bf92f3577b34da6a3ce929d0e0e4736'
const T2 = '7d3a5f9c1e2b48a6b0d4f5e6c7a8b9d0'
const T3 = '9e4b6a8d2f3c59b7c1e5f6a7d8c9e0f1'

function sampleBody() {
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: 'service.name', value: str('vite-devtools-demo') }] },
        scopeSpans: [
          {
            spans: buildSpans(now - 420, [
              {
                traceId: T1,
                spanId: '00f067aa0ba902b7',
                name: 'GET /api/checkout',
                kind: 1,
                offset: 0,
                duration: 420,
                attributes: [{ key: 'http.method', value: str('GET') }, {
                  key: 'http.route',
                  value: str('/api/checkout'),
                }, { key: 'http.status_code', value: num(200) }],
              },
              {
                traceId: T1,
                spanId: 'b7ad6b7169203331',
                parentSpanId: '00f067aa0ba902b7',
                name: 'auth.verify',
                kind: 2,
                offset: 8,
                duration: 64,
                attributes: [{ key: 'enduser.id', value: str('user-4821') }],
              },
              {
                traceId: T1,
                spanId: 'c81e728d9d4c2f63',
                parentSpanId: '00f067aa0ba902b7',
                name: 'cart.load',
                kind: 2,
                offset: 20,
                duration: 96,
                attributes: [{ key: 'cart.items', value: num(3) }, { key: 'db.system', value: str('postgresql') }],
              },
              {
                traceId: T1,
                spanId: 'd27b4567c9a3b4f71',
                parentSpanId: 'c81e728d9d4c2f63',
                name: 'db.query items',
                kind: 2,
                offset: 28,
                duration: 52,
                attributes: [{ key: 'db.rows', value: num(3) }],
              },
              {
                traceId: T1,
                spanId: 'e33c1959d2f7a1b64',
                parentSpanId: '00f067aa0ba902b7',
                name: 'process-payment',
                kind: 0,
                offset: 40,
                duration: 260,
                status: { code: 2, message: 'card declined' },
                attributes: [{ key: 'amount', value: num(42) }, { key: 'currency', value: str('USD') }],
                events: [{
                  at: 250,
                  name: 'exception',
                  attributes: [{ key: 'exception.message', value: str('card declined') }],
                }],
              },
              {
                traceId: T1,
                spanId: 'f47d8234b1c9d5e77',
                parentSpanId: 'e33c1959d2f7a1b64',
                name: 'gateway.charge',
                kind: 2,
                offset: 52,
                duration: 180,
                status: { code: 2, message: 'card declined' },
                attributes: [{ key: 'rpc.system', value: str('stripe') }],
                events: [{ at: 170, name: 'retry', attributes: [{ key: 'attempt', value: num(2) }] }],
              },
              {
                traceId: T1,
                spanId: 'a55e91c2d4b83f609',
                parentSpanId: 'f47d8234b1c9d5e77',
                name: 'tls.handshake',
                kind: 2,
                offset: 56,
                duration: 22,
              },
              {
                traceId: T1,
                spanId: 'b66f02d3e5c94a710',
                parentSpanId: 'e33c1959d2f7a1b64',
                name: 'notify.user',
                kind: 4,
                offset: 240,
                duration: 48,
                attributes: [{ key: 'messaging.system', value: str('kafka') }],
              },
              {
                traceId: T1,
                spanId: 'c77a13e4f6d05b821',
                parentSpanId: '00f067aa0ba902b7',
                name: 'render.receipt',
                kind: 0,
                offset: 310,
                duration: 92,
              },
            ]),
          },
        ],
      },
      {
        resource: { attributes: [{ key: 'service.name', value: str('search-api') }] },
        scopeSpans: [
          {
            spans: buildSpans(now - 900, [
              {
                traceId: T2,
                spanId: '10f067aa0ba902b1',
                name: 'GET /api/search',
                kind: 1,
                offset: 0,
                duration: 310,
                attributes: [{ key: 'http.route', value: str('/api/search') }, {
                  key: 'http.status_code',
                  value: num(200),
                }],
              },
              {
                traceId: T2,
                spanId: '20ad6b7169203332',
                parentSpanId: '10f067aa0ba902b1',
                name: 'parse.query',
                kind: 0,
                offset: 4,
                duration: 18,
              },
              {
                traceId: T2,
                spanId: '30e728d9d4c2f634',
                parentSpanId: '10f067aa0ba902b1',
                name: 'index.lookup',
                kind: 2,
                offset: 26,
                duration: 140,
                attributes: [{ key: 'db.system', value: str('elasticsearch') }],
              },
              {
                traceId: T2,
                spanId: '407b4567c9a3b4f72',
                parentSpanId: '30e728d9d4c2f634',
                name: 'shard.a',
                kind: 2,
                offset: 30,
                duration: 88,
              },
              {
                traceId: T2,
                spanId: '517c1959d2f7a1b65',
                parentSpanId: '30e728d9d4c2f634',
                name: 'shard.b',
                kind: 2,
                offset: 34,
                duration: 104,
              },
              {
                traceId: T2,
                spanId: '627d8234b1c9d5e78',
                parentSpanId: '10f067aa0ba902b1',
                name: 'rank.results',
                kind: 0,
                offset: 170,
                duration: 96,
              },
              {
                traceId: T2,
                spanId: '73f91c2d4b83f60a',
                parentSpanId: '10f067aa0ba902b1',
                name: 'cache.write',
                kind: 3,
                offset: 270,
                duration: 28,
              },
            ]),
          },
        ],
      },
      {
        resource: { attributes: [{ key: 'service.name', value: str('billing-worker') }] },
        scopeSpans: [
          {
            spans: buildSpans(now - 2400, [
              {
                traceId: T3,
                spanId: '81a067bb1cb913c2',
                name: 'invoice.generate',
                kind: 3,
                offset: 0,
                duration: 1180,
                attributes: [{ key: 'job.id', value: str('inv-2026-1042') }],
              },
              {
                traceId: T3,
                spanId: '92be7c8270314443',
                parentSpanId: '81a067bb1cb913c2',
                name: 'fetch.usage',
                kind: 2,
                offset: 12,
                duration: 420,
              },
              {
                traceId: T3,
                spanId: 'a3cf839380425554',
                parentSpanId: '81a067bb1cb913c2',
                name: 'apply.discounts',
                kind: 0,
                offset: 440,
                duration: 210,
              },
              {
                traceId: T3,
                spanId: 'b4d094a491536665',
                parentSpanId: '81a067bb1cb913c2',
                name: 'render.pdf',
                kind: 0,
                offset: 660,
                duration: 480,
              },
              {
                traceId: T3,
                spanId: 'c5e1a5b5a2647776',
                parentSpanId: 'b4d094a491536665',
                name: 'embed.fonts',
                kind: 0,
                offset: 700,
                duration: 180,
              },
              {
                traceId: T3,
                spanId: 'd6f2b6c6b3758887',
                parentSpanId: '81a067bb1cb913c2',
                name: 'email.send',
                kind: 4,
                offset: 1150,
                duration: 24,
              },
            ]),
          },
        ],
      },
    ],
    resourceLogs: [
      {
        resource: { attributes: [{ key: 'service.name', value: str('vite-devtools-demo') }] },
        scopeLogs: [
          {
            logRecords: [
              {
                timeUnixNano: nano(now - 410),
                severityNumber: 9,
                severityText: 'INFO',
                body: { stringValue: 'Checkout started' },
                traceId: T1,
                spanId: '00f067aa0ba902b7',
              },
              {
                timeUnixNano: nano(now - 180),
                severityNumber: 13,
                severityText: 'WARN',
                body: { stringValue: 'Retrying charge, attempt 2 of 3' },
                traceId: T1,
                spanId: 'f47d8234b1c9d5e77',
                attributes: [{ key: 'attempt', value: num(2) }],
              },
              {
                timeUnixNano: nano(now - 200),
                severityNumber: 17,
                severityText: 'ERROR',
                body: { stringValue: 'Payment failed: card declined' },
                traceId: T1,
                spanId: 'e33c1959d2f7a1b64',
                attributes: [{ key: 'amount', value: num(42) }],
              },
            ],
          },
        ],
      },
      {
        resource: { attributes: [{ key: 'service.name', value: str('search-api') }] },
        scopeLogs: [
          {
            logRecords: [
              {
                timeUnixNano: nano(now - 700),
                severityNumber: 9,
                severityText: 'INFO',
                body: { stringValue: 'Search completed in 310ms' },
                traceId: T2,
                spanId: '10f067aa0ba902b1',
                attributes: [{ key: 'hits', value: num(128) }],
              },
              {
                timeUnixNano: nano(now - 690),
                severityNumber: 5,
                severityText: 'DEBUG',
                body: { stringValue: 'Shard fan-out: 2 shards, slowest 104ms' },
                traceId: T2,
                spanId: '30e728d9d4c2f634',
              },
            ],
          },
        ],
      },
      {
        resource: { attributes: [{ key: 'service.name', value: str('billing-worker') }] },
        scopeLogs: [
          {
            logRecords: [
              {
                timeUnixNano: nano(now - 1250),
                severityNumber: 9,
                severityText: 'INFO',
                body: { stringValue: 'Invoice inv-2026-1042 generated' },
                traceId: T3,
                spanId: '81a067bb1cb913c2',
              },
              {
                timeUnixNano: nano(now - 60),
                severityNumber: 21,
                severityText: 'FATAL',
                body: { stringValue: 'Disk usage above 95% on worker-02' },
                attributes: [{ key: 'disk.used_percent', value: num(96) }],
              },
            ],
          },
        ],
      },
    ],
    // Metric values mirror `client/app/fixtures.ts` at its first, middle and
    // last data points. int64-ish fields arrive as JSON strings, as OTLP JSON
    // encoders commonly emit them.
    resourceMetrics: [
      {
        resource: { attributes: [{ key: 'service.name', value: str('vite-devtools-demo') }] },
        scopeMetrics: [
          {
            metrics: [
              {
                name: 'http.requests.total',
                description: 'Total HTTP requests',
                unit: '1',
                sum: {
                  isMonotonic: true,
                  aggregationTemporality: 2,
                  dataPoints: [
                    { timeUnixNano: nano(now - 30_000), asInt: '7' },
                    { timeUnixNano: nano(now - 15_000), asInt: '63' },
                    { timeUnixNano: nano(now), asInt: '112' },
                  ],
                },
              },
              {
                name: 'process.memory.heap',
                description: 'Heap size',
                unit: 'By',
                gauge: {
                  dataPoints: [
                    { timeUnixNano: nano(now - 30_000), asDouble: 40_000_000 },
                    { timeUnixNano: nano(now - 15_000), asDouble: 44_000_000 },
                    { timeUnixNano: nano(now), asDouble: 43_750_000 },
                  ],
                },
              },
              {
                name: 'http.server.duration',
                description: 'Server request duration',
                unit: 'ms',
                histogram: {
                  aggregationTemporality: 2,
                  dataPoints: [
                    {
                      timeUnixNano: nano(now - 30_000),
                      count: '16',
                      sum: '1200',
                      min: 4,
                      max: 480,
                      explicitBounds: [10, 50, 100, 500],
                      bucketCounts: ['2', '6', '5', '3'],
                      attributes: [{ key: 'http.route', value: str('/api/checkout') }],
                    },
                    {
                      timeUnixNano: nano(now - 15_000),
                      count: '24',
                      sum: '1520',
                      min: 4,
                      max: 480,
                      explicitBounds: [10, 50, 100, 500],
                      bucketCounts: ['2', '6', '5', '3'],
                      attributes: [{ key: 'http.route', value: str('/api/checkout') }],
                    },
                    {
                      timeUnixNano: nano(now),
                      count: '31',
                      sum: '1800',
                      min: 4,
                      max: 480,
                      explicitBounds: [10, 50, 100, 500],
                      bucketCounts: ['2', '6', '5', '3'],
                      attributes: [{ key: 'http.route', value: str('/api/checkout') }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  }
}

async function sendSamples(out: HTMLElement) {
  try {
    const res = await fetch('/__opentelemetry-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleBody()),
    })
    out.textContent = `ingest: ${res.status} ${await res.text()} — check the OpenTelemetry panel`
  } catch (e) {
    out.textContent = `failed: ${(e as Error).message}`
  }
}

document.querySelector('#app')!.innerHTML = `
  <h1>vite-opentelemetry-inspector demo</h1>
  <p>Run with Vite DevTools enabled to see the OpenTelemetry panel.</p>
  <p>Samples seed automatically on load (3 traces, 7 logs, 3 metrics).</p>
  <button id="send">Resend samples</button>
  <pre id="out"></pre>
`

const out = document.querySelector('#out')!
document.querySelector('#send')!.addEventListener('click', () => void sendSamples(out))
// Seed on startup so the panel has data immediately (stable span/trace IDs
// make reseeds idempotent; each load adds one more copy of the logs and
// metric data points).
void sendSamples(out)
