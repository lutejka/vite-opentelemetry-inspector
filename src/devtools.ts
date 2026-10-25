import type { DevframeDefinition } from 'devframe'
import { defineDevframe, defineRpcFunction } from 'devframe'
import type { SharedState } from 'devframe/utils/shared-state'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pkg from '../package.json' with { type: 'json' }
import { ingestOtlpBody } from './otel/ingest.ts'
import { createOtelStore } from './store.ts'
import type { Log, Metric, Span, Trace } from './types.ts'

/** Namespace of the RPC functions and shared state registered by this devframe. */
export const OPENTELEMETRY_DEVFRAME_NAMESPACE = 'opentelemetry'

export interface OpentelemetryDevframeState {
  traces: Trace[]
  spans: Span[]
  logs: Log[]
  metrics: Metric[]
}

declare module 'devframe' {
  interface DevframeRpcSharedStates {
    'opentelemetry:otel': OpentelemetryDevframeState
  }
}

export interface OpentelemetryDevframeUIOptions {
  /** Accent colour, as any CSS colour. Defaults to the host's brand colour, where it sets one. */
  primaryColor?: string
  /** Documentation linked from the panel. */
  docsURL?: string
}

export interface OpentelemetryDevframeOptions {
  /** Devframe id; also the default mount base (`/__<id>/`) and dock id. Default `opentelemetry`. */
  id?: string
  /** Dock title. Default `OpenTelemetry`. */
  name?: string
  icon?: string
  basePath?: string
  ui?: OpentelemetryDevframeUIOptions
}

export interface OpentelemetryDevframe {
  definition: DevframeDefinition
  /** Record traces/spans/logs directly. Safe to call before or after the devframe is set up, and from multiple hosts. */
  exposeTraces: (traces: Trace[]) => void
  exposeSpans: (spans: Span[]) => void
  exposeLogs: (logs: Log[]) => void
  /** Record metric data points directly. Safe to call before or after the devframe is set up, and from multiple hosts. */
  exposeMetrics: (metrics: Metric[]) => void
  /** Ingest a raw OTLP JSON body (`/v1/traces`, `/v1/logs` and/or `/v1/metrics` shapes). */
  ingest: (body: unknown) => void
  clearTraces: () => void
  clearLogs: () => void
  clearMetrics: () => void
}

const FLUSH_DELAY = 50

/**
 * Resolve the built client SPA directory.
 *
 * A relative URL against `import.meta.url` is fragile: bundlers may emit this
 * module at `dist/devtools.mjs` or code-split it to `dist/chunks/*.mjs`,
 * which changes the depth. Ascending to the package root is robust in every
 * layout (source `src/`, flat `dist/`, or nested `dist/chunks/`).
 */
function resolveClientAssets(): string {
  const packageName = (pkg as { name?: string }).name
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 6; i++) {
    const manifest = join(dir, 'package.json')
    if (packageName && existsSync(manifest)) {
      try {
        if (JSON.parse(readFileSync(manifest, 'utf8')).name === packageName) {
          return join(dir, 'dist', 'devtools-client')
        }
      } catch {
        // Unreadable manifest — keep ascending.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // Fallback: historical relative layout (flat `dist/` output without chunking).
  return fileURLToPath(new URL('../dist/devtools-client', import.meta.url))
}

/**
 * Create an OpenTelemetry inspector devframe for mounting in Vite DevTools,
 * or any other devframe host. Ported from `nuxt-otel`'s devtools UI + RPC +
 * OTLP ingest + MCP tools, following the `fontless` (`unjs/fontaine#877`) shape.
 */
export function createOpentelemetryDevframe(options: OpentelemetryDevframeOptions = {}): OpentelemetryDevframe {
  const store = createOtelStore()
  const states = new Set<SharedState<OpentelemetryDevframeState>>()

  function snapshot(): OpentelemetryDevframeState {
    return {
      traces: [...store.getTraces()],
      spans: [...store.getSpans()],
      logs: [...store.getLogs()],
      metrics: [...store.getMetrics()],
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  function flush() {
    timer = undefined
    const value = snapshot()
    for (const state of states) {
      state.mutate((draft) => {
        draft.traces = value.traces
        draft.spans = value.spans
        draft.logs = value.logs
        draft.metrics = value.metrics
      })
    }
  }
  function scheduleFlush() {
    if (states.size) {
      timer ??= setTimeout(flush, FLUSH_DELAY)
    }
  }

  const unsubscribe = store.onChange(scheduleFlush)

  function exposeTraces(traces: Trace[]) {
    store.addTraces(structuredClone(traces))
  }

  function exposeSpans(spans: Span[]) {
    store.addSpans(structuredClone(spans))
  }

  function exposeLogs(logs: Log[]) {
    store.addLogs(structuredClone(logs))
  }

  function exposeMetrics(metrics: Metric[]) {
    store.addMetrics(structuredClone(metrics))
  }

  function ingest(body: unknown) {
    ingestOtlpBody(store, body)
  }

  function clearTraces() {
    store.clearTraces()
  }

  function clearLogs() {
    store.clearLogs()
  }

  function clearMetrics() {
    store.clearMetrics()
  }

  const getTraces = defineRpcFunction({
    name: 'get-traces',
    type: 'query',
    jsonSerializable: true,
    agent: {
      description: 'Retrieve all collected OpenTelemetry traces, newest last. Safe to call freely.',
    },
    handler: () => store.getTraces(),
  })

  const getTrace = defineRpcFunction({
    name: 'get-trace',
    type: 'query',
    jsonSerializable: true,
    agent: {
      description: 'Retrieve a single trace and its spans by trace_id. Safe to call freely.',
    },
    handler: (traceId: string) => store.getTrace(traceId),
  })

  const getSpans = defineRpcFunction({
    name: 'get-spans',
    type: 'query',
    jsonSerializable: true,
    agent: {
      description: 'Retrieve collected spans, optionally filtered by trace_id. Safe to call freely.',
    },
    handler: (traceId?: string) => store.getSpans(traceId),
  })

  const getLogs = defineRpcFunction({
    name: 'get-logs',
    type: 'query',
    jsonSerializable: true,
    agent: {
      description: 'Retrieve all collected OpenTelemetry logs, oldest first. Safe to call freely.',
    },
    handler: () => store.getLogs(),
  })

  const getMetrics = defineRpcFunction({
    name: 'get-metrics',
    type: 'query',
    jsonSerializable: true,
    agent: {
      description:
        'Retrieve collected OpenTelemetry metric data points, oldest first. Flat records — group by `name` to reconstruct a metric series. Safe to call freely.',
    },
    handler: () => store.getMetrics(),
  })

  const clearTracesFn = defineRpcFunction({
    name: 'clear-traces',
    type: 'action',
    jsonSerializable: true,
    handler: () => {
      store.clearTraces()
    },
  })

  const clearLogsFn = defineRpcFunction({
    name: 'clear-logs',
    type: 'action',
    jsonSerializable: true,
    handler: () => {
      store.clearLogs()
    },
  })

  const clearMetricsFn = defineRpcFunction({
    name: 'clear-metrics',
    type: 'action',
    jsonSerializable: true,
    handler: () => {
      store.clearMetrics()
    },
  })

  const definition: DevframeDefinition = defineDevframe({
    id: options.id ?? 'opentelemetry',
    name: options.name ?? 'OpenTelemetry',
    version: (pkg as { version: string }).version,
    packageName: (pkg as { name: string }).name,
    importMetaUrl: import.meta.url,
    homepage: (pkg as { homepage?: string }).homepage ?? 'https://github.com/lutejka/vite-opentelemetry-inspector',
    description: (pkg as { description?: string }).description
      ?? 'OpenTelemetry traces, logs & metrics inspector devframe',
    icon: options.icon ?? 'simple-icons:opentelemetry',
    basePath: options.basePath,
    clientAssets: resolveClientAssets(),
    capabilities: { build: false },
    async setup(ctx) {
      const scoped = ctx.scope(OPENTELEMETRY_DEVFRAME_NAMESPACE)
      scoped.rpc.register(getTraces)
      scoped.rpc.register(getTrace)
      scoped.rpc.register(getSpans)
      scoped.rpc.register(getLogs)
      scoped.rpc.register(getMetrics)
      scoped.rpc.register(clearTracesFn)
      scoped.rpc.register(clearLogsFn)
      scoped.rpc.register(clearMetricsFn)

      const state = await scoped.rpc.sharedState('otel', {
        initialValue: { traces: [], spans: [], logs: [], metrics: [] } satisfies OpentelemetryDevframeState,
      })
      const value = snapshot()
      state.mutate((draft) => {
        draft.traces = value.traces
        draft.spans = value.spans
        draft.logs = value.logs
        draft.metrics = value.metrics
      })
      states.add(state)
      void unsubscribe
    },
  })

  return {
    definition,
    exposeTraces,
    exposeSpans,
    exposeLogs,
    exposeMetrics,
    ingest,
    clearTraces,
    clearLogs,
    clearMetrics,
  }
}
