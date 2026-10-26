import type { Log, Metric, Span, Trace } from '../../src/types.ts'

interface SpanSpec {
  id: string
  parent: string | null
  name: string
  kind: number
  offset: number
  duration: number
  status?: number
  statusMessage?: string | null
  attributes?: Record<string, unknown>
  events?: Array<{ at: number; name: string; attributes?: Record<string, unknown> }>
}

/**
 * Deterministic metric fixtures: 3 series × 16 points, 15 s apart, ending at
 * `now`. Formulas are intentionally simple so sparklines are easy to eyeball.
 */
function createMetrics(now: number): Metric[] {
  const metrics: Metric[] = []
  for (let i = 0; i < 16; i++) {
    const timestamp = now - (15 - i) * 15_000
    // Round-robin the extra samples so `count` always equals the bucket sum;
    // otherwise the histogram chart would invent a large overflow bucket.
    const durationBuckets = [
      { bound: 10, count: 2 },
      { bound: 50, count: 6 },
      { bound: 100, count: 5 },
      { bound: 500, count: 3 },
    ]
    for (let extra = 0; extra < i; extra++) {
      durationBuckets[extra % durationBuckets.length]!.count += 1
    }
    metrics.push(
      {
        metric_id: `fixture-heap-${i}`,
        name: 'process.memory.heap',
        description: 'Heap size',
        unit: 'By',
        type: 'gauge',
        service_name: 'vite-devtools-demo',
        timestamp,
        value: 40_000_000 + i * 250_000 + (i % 3) * 1_000_000,
        histogram: null,
        attributes: {},
      },
      {
        metric_id: `fixture-requests-${i}`,
        name: 'http.requests.total',
        description: 'Total HTTP requests',
        unit: 'req',
        type: 'counter',
        service_name: 'vite-devtools-demo',
        timestamp,
        value: (i + 1) * 7,
        histogram: null,
        attributes: {},
      },
      {
        metric_id: `fixture-duration-${i}`,
        name: 'http.server.duration',
        description: 'Server request duration',
        unit: 'ms',
        type: 'histogram',
        service_name: 'vite-devtools-demo',
        timestamp,
        value: null,
        histogram: {
          buckets: durationBuckets.map(bucket => ({ ...bucket })),
          sum: 1200 + i * 40,
          count: 16 + i,
          min: 4,
          max: 480,
        },
        attributes: { 'http.route': '/api/checkout' },
      },
    )
  }
  return metrics
}

let liveTick = 0

/**
 * One fresh sample for each fixture series, used by the local dev server's
 * live ticker to exercise chart animations. Values follow slow sine waves so
 * the gauge marker travels instead of jumping around at random.
 */
export function createLiveMetricTick(now = Date.now()): Metric[] {
  const tick = ++liveTick
  const phase = now / 10_000
  const heap = Math.round(40_000_000 + Math.sin(phase) * 4_000_000 + Math.sin(phase * 2.7) * 1_000_000)
  const requests = Math.round(150 + Math.sin(phase * 1.4) * 30 + Math.sin(phase * 3.1) * 6)
  const durationBuckets = [2, 6, 5, 3].map((count, index) => ({
    bound: [10, 50, 100, 500][index]!,
    count: count + Math.round((Math.sin(phase + index) + 1) * 2),
  }))
  const histogramCount = durationBuckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const histogramSum = Math.round(histogramCount * (75 + Math.sin(phase / 4) * 15))

  return [
    {
      metric_id: `live-heap-${now}-${tick}`,
      name: 'process.memory.heap',
      description: 'Heap size',
      unit: 'By',
      type: 'gauge',
      service_name: 'vite-devtools-demo',
      timestamp: now,
      value: heap,
      histogram: null,
      attributes: {},
    },
    {
      metric_id: `live-requests-${now}-${tick}`,
      name: 'http.requests.total',
      description: 'Total HTTP requests',
      unit: 'req',
      type: 'counter',
      service_name: 'vite-devtools-demo',
      timestamp: now,
      value: requests,
      histogram: null,
      attributes: {},
    },
    {
      metric_id: `live-duration-${now}-${tick}`,
      name: 'http.server.duration',
      description: 'Server request duration',
      unit: 'ms',
      type: 'histogram',
      service_name: 'vite-devtools-demo',
      timestamp: now,
      value: null,
      histogram: {
        buckets: durationBuckets,
        sum: histogramSum,
        count: histogramCount,
        min: 4,
        max: 480,
      },
      attributes: { 'http.route': '/api/checkout' },
    },
  ]
}

/** Deterministic fixtures for local client development (`pnpm dev:client`). */
export function createFixtures(): Array<{ traces: Trace[]; spans: Span[]; logs: Log[]; metrics: Metric[] }> {
  const now = Date.now()
  const traces: Trace[] = []
  const spans: Span[] = []
  const logs: Log[] = []
  const metrics = createMetrics(now)

  function addTrace(
    traceId: string,
    service: string,
    operation: string,
    startAgo: number,
    specs: SpanSpec[],
    traceStatus = 0,
    traceMessage: string | null = null,
  ) {
    const rootSpecs = specs.filter(s => s.parent === null)
    const start = now - startAgo
    const end = Math.max(...specs.map(s => start + s.offset + s.duration))
    traces.push({
      trace_id: traceId,
      service_name: service,
      operation_name: operation,
      start_time: start,
      end_time: end,
      duration: end - start,
      status_code: traceStatus,
      status_message: traceMessage,
    })
    for (const spec of specs) {
      const spanStart = start + spec.offset
      spans.push({
        span_id: spec.id,
        trace_id: traceId,
        parent_span_id: spec.parent,
        name: spec.name,
        kind: spec.kind,
        start_time: spanStart,
        end_time: spanStart + spec.duration,
        duration: spec.duration,
        status_code: spec.status ?? 0,
        status_message: spec.statusMessage ?? null,
        attributes: spec.attributes ?? {},
        events: (spec.events ?? []).map(e => ({
          time: spanStart + e.at,
          name: e.name,
          attributes: e.attributes ?? {},
        })),
        links: [],
      })
    }
    void rootSpecs
  }

  function addLog(
    logId: string,
    at: number,
    traceId: string | null,
    spanId: string | null,
    severityNumber: number,
    severityText: string,
    body: string,
    service: string,
    attributes: Record<string, unknown> = {},
  ) {
    logs.push({
      log_id: logId,
      timestamp: now - at,
      trace_id: traceId,
      span_id: spanId,
      severity_number: severityNumber,
      severity_text: severityText,
      body,
      service_name: service,
      attributes,
    })
  }

  // Trace 1: checkout flow with a failing payment branch (deep tree).
  const t1 = '4bf92f3577b34da6a3ce929d0e0e4736'
  addTrace(
    t1,
    'vite-devtools-demo',
    'GET /api/checkout',
    420,
    [
      {
        id: '00f067aa0ba902b7',
        parent: null,
        name: 'GET /api/checkout',
        kind: 1,
        offset: 0,
        duration: 420,
        attributes: { 'http.method': 'GET', 'http.route': '/api/checkout', 'http.status_code': 200 },
      },
      {
        id: 'b7ad6b7169203331',
        parent: '00f067aa0ba902b7',
        name: 'auth.verify',
        kind: 2,
        offset: 8,
        duration: 64,
        attributes: { 'enduser.id': 'user-4821' },
      },
      {
        id: 'c81e728d9d4c2f63',
        parent: '00f067aa0ba902b7',
        name: 'cart.load',
        kind: 2,
        offset: 20,
        duration: 96,
        attributes: { 'cart.items': 3, 'db.system': 'postgresql', 'db.statement': 'SELECT * FROM carts WHERE id = $1' },
      },
      {
        id: 'd27b4567c9a3b4f71',
        parent: 'c81e728d9d4c2f63',
        name: 'db.query items',
        kind: 2,
        offset: 28,
        duration: 52,
        attributes: { 'db.rows': 3 },
      },
      {
        id: 'e33c1959d2f7a1b64',
        parent: '00f067aa0ba902b7',
        name: 'process-payment',
        kind: 0,
        offset: 40,
        duration: 260,
        status: 2,
        statusMessage: 'card declined',
        attributes: { amount: 42, currency: 'USD', error: true },
        events: [{ at: 250, name: 'exception', attributes: { 'exception.message': 'card declined' } }],
      },
      {
        id: 'f47d8234b1c9d5e77',
        parent: 'e33c1959d2f7a1b64',
        name: 'gateway.charge',
        kind: 2,
        offset: 52,
        duration: 180,
        status: 2,
        statusMessage: 'card declined',
        attributes: { 'rpc.system': 'stripe', 'rpc.service': 'charges' },
        events: [{ at: 170, name: 'retry', attributes: { attempt: 2 } }],
      },
      {
        id: 'a55e91c2d4b83f609',
        parent: 'f47d8234b1c9d5e77',
        name: 'tls.handshake',
        kind: 2,
        offset: 56,
        duration: 22,
      },
      {
        id: 'b66f02d3e5c94a710',
        parent: 'e33c1959d2f7a1b64',
        name: 'notify.user',
        kind: 4,
        offset: 240,
        duration: 48,
        attributes: { 'messaging.system': 'kafka', 'messaging.destination': 'notifications' },
      },
      {
        id: 'c77a13e4f6d05b821',
        parent: '00f067aa0ba902b7',
        name: 'render.receipt',
        kind: 0,
        offset: 310,
        duration: 92,
        attributes: { 'template.name': 'receipt.html' },
      },
    ],
    2,
    'card declined',
  )

  // Trace 2: healthy search flow with parallel fan-out.
  const t2 = '7d3a5f9c1e2b48a6b0d4f5e6c7a8b9d0'
  addTrace(t2, 'search-api', 'GET /api/search', 900, [
    {
      id: '10f067aa0ba902b1',
      parent: null,
      name: 'GET /api/search',
      kind: 1,
      offset: 0,
      duration: 310,
      attributes: { 'http.method': 'GET', 'http.route': '/api/search', 'http.status_code': 200 },
    },
    {
      id: '20ad6b7169203332',
      parent: '10f067aa0ba902b1',
      name: 'parse.query',
      kind: 0,
      offset: 4,
      duration: 18,
      attributes: { 'query.text': 'waterfall chart' },
    },
    {
      id: '30e728d9d4c2f634',
      parent: '10f067aa0ba902b1',
      name: 'index.lookup',
      kind: 2,
      offset: 26,
      duration: 140,
      attributes: { 'db.system': 'elasticsearch', 'search.hits': 128 },
    },
    { id: '407b4567c9a3b4f72', parent: '30e728d9d4c2f634', name: 'shard.a', kind: 2, offset: 30, duration: 88 },
    { id: '517c1959d2f7a1b65', parent: '30e728d9d4c2f634', name: 'shard.b', kind: 2, offset: 34, duration: 104 },
    {
      id: '627d8234b1c9d5e78',
      parent: '10f067aa0ba902b1',
      name: 'rank.results',
      kind: 0,
      offset: 170,
      duration: 96,
      attributes: { 'ranking.model': 'v3' },
    },
    {
      id: '73f91c2d4b83f60a',
      parent: '10f067aa0ba902b1',
      name: 'cache.write',
      kind: 3,
      offset: 270,
      duration: 28,
      attributes: { 'cache.key': 'search:waterfall chart' },
    },
  ])

  // Trace 3: background worker, slow but healthy.
  const t3 = '9e4b6a8d2f3c59b7c1e5f6a7d8c9e0f1'
  addTrace(t3, 'billing-worker', 'invoice.generate', 2400, [
    {
      id: '81a067bb1cb913c2',
      parent: null,
      name: 'invoice.generate',
      kind: 3,
      offset: 0,
      duration: 1180,
      attributes: { 'job.id': 'inv-2026-1042', 'customer.id': 'cus-9917' },
    },
    {
      id: '92be7c8270314443',
      parent: '81a067bb1cb913c2',
      name: 'fetch.usage',
      kind: 2,
      offset: 12,
      duration: 420,
      attributes: { 'db.system': 'clickhouse' },
    },
    {
      id: 'a3cf839380425554',
      parent: '81a067bb1cb913c2',
      name: 'apply.discounts',
      kind: 0,
      offset: 440,
      duration: 210,
      attributes: { 'discount.codes': 2 },
    },
    {
      id: 'b4d094a491536665',
      parent: '81a067bb1cb913c2',
      name: 'render.pdf',
      kind: 0,
      offset: 660,
      duration: 480,
      attributes: { 'pdf.pages': 4 },
    },
    { id: 'c5e1a5b5a2647776', parent: 'b4d094a491536665', name: 'embed.fonts', kind: 0, offset: 700, duration: 180 },
    {
      id: 'd6f2b6c6b3758887',
      parent: '81a067bb1cb913c2',
      name: 'email.send',
      kind: 4,
      offset: 1150,
      duration: 24,
      attributes: { 'messaging.destination': 'billing@acme.test' },
    },
  ])

  addLog(
    '0190c8a1-7e9a-7a1e-9b1e-3d5b6a7c8d9e',
    200,
    t1,
    'e33c1959d2f7a1b64',
    17,
    'ERROR',
    'Payment failed: card declined',
    'vite-devtools-demo',
    { amount: 42 },
  )
  addLog(
    '1290c8a1-7e9a-7a1e-9b1e-3d5b6a7c8d9f',
    410,
    t1,
    '00f067aa0ba902b7',
    9,
    'INFO',
    'Checkout started',
    'vite-devtools-demo',
  )
  addLog(
    '2390c8a1-7e9a-7a1e-9b1e-3d5b6a7c8da0',
    180,
    t1,
    'f47d8234b1c9d5e77',
    13,
    'WARN',
    'Retrying charge, attempt 2 of 3',
    'vite-devtools-demo',
    { attempt: 2 },
  )
  addLog(
    '3490c8a1-7e9a-7a1e-9b1e-3d5b6a7c8db1',
    700,
    t2,
    '10f067aa0ba902b1',
    9,
    'INFO',
    'Search completed in 310ms',
    'search-api',
    { hits: 128 },
  )
  addLog(
    '4590c8a1-7e9a-7a1e-9b1e-3d5b6a7c8dc2',
    690,
    t2,
    '30e728d9d4c2f634',
    5,
    'DEBUG',
    'Shard fan-out: 2 shards, slowest 104ms',
    'search-api',
  )
  addLog(
    '5690c8a1-7e9a-7a1e-9b1e-3d5b6a7c8dd3',
    1250,
    t3,
    '81a067bb1cb913c2',
    9,
    'INFO',
    'Invoice inv-2026-1042 generated',
    'billing-worker',
    { pages: 4 },
  )
  addLog(
    '6790c8a1-7e9a-7a1e-9b1e-3d5b6a7c8de4',
    60,
    null,
    null,
    21,
    'FATAL',
    'Disk usage above 95% on worker-02',
    'billing-worker',
    { 'disk.used_percent': 96 },
  )

  return [{ traces, spans, logs, metrics }]
}
