import { ref } from 'vue'
import type { Log, Metric, Span, Trace } from '../../src/types.ts'

/**
 * Devframe-backed telemetry state. Replaces the Nuxt `rpc-connector` plugin
 * (`useState` + `onDevtoolsClientConnected` + `extendClientRpc`) with the
 * framework-neutral `devframe/client` connection:
 * initial snapshot from `get-traces`/`get-spans`/`get-logs`/`get-metrics` RPC, then live
 * updates from the `opentelemetry:otel` shared state when available,
 * with polling as a fallback.
 */

const traces = ref<Trace[]>([])
const spans = ref<Span[]>([])
const logs = ref<Log[]>([])
const metrics = ref<Metric[]>([])
const connected = ref(false)
const error = ref<string | null>(null)

let pollTimer: ReturnType<typeof setInterval> | undefined
let offSharedState: (() => void) | undefined
let started = false

async function loadSnapshot(call: (method: string, ...args: unknown[]) => Promise<unknown>) {
  const [t, s, l, m] = await Promise.allSettled([
    call('get-traces'),
    call('get-spans'),
    call('get-logs'),
    call('get-metrics'),
  ])
  if (t.status === 'fulfilled' && Array.isArray(t.value)) traces.value = t.value as Trace[]
  if (s.status === 'fulfilled' && Array.isArray(s.value)) spans.value = s.value as Span[]
  if (l.status === 'fulfilled' && Array.isArray(l.value)) logs.value = l.value as Log[]
  if (m.status === 'fulfilled' && Array.isArray(m.value)) metrics.value = m.value as Metric[]
}

async function connect() {
  if (started) return
  started = true
  try {
    const { connectDevframe } = await import('devframe/client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoped: any = (await connectDevframe()).scope('opentelemetry')
    const call = (method: string, ...args: unknown[]) => scoped.rpc.call(method, ...args) as Promise<unknown>
    await loadSnapshot(call)
    connected.value = true

    // Prefer shared-state subscription for live updates; fall back to polling.
    try {
      const state = await scoped.rpc.sharedState?.('otel')
      if (state && typeof state.subscribe === 'function') {
        offSharedState = state.subscribe(
          (value: { traces?: Trace[]; spans?: Span[]; logs?: Log[]; metrics?: Metric[] }) => {
            if (Array.isArray(value?.traces)) traces.value = value.traces
            if (Array.isArray(value?.spans)) spans.value = value.spans
            if (Array.isArray(value?.logs)) logs.value = value.logs
            if (Array.isArray(value?.metrics)) metrics.value = value.metrics
          },
        )
        return
      }
      if (state && typeof state.onChange === 'function') {
        offSharedState = state.onChange(
          (value: { traces?: Trace[]; spans?: Span[]; logs?: Log[]; metrics?: Metric[] }) => {
            if (Array.isArray(value?.traces)) traces.value = value.traces
            if (Array.isArray(value?.spans)) spans.value = value.spans
            if (Array.isArray(value?.logs)) logs.value = value.logs
            if (Array.isArray(value?.metrics)) metrics.value = value.metrics
          },
        )
        return
      }
    } catch {
      // fall through to polling
    }
    pollTimer = setInterval(() => {
      loadSnapshot(call).catch(() => {})
    }, 1000)
  } catch (e) {
    error.value = (e as Error)?.message || 'Failed to connect to devframe backend'
  }
}

async function rpcCall(method: string, ...args: unknown[]): Promise<unknown> {
  const { connectDevframe } = await import('devframe/client')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped: any = (await connectDevframe()).scope('opentelemetry')
  return scoped.rpc.call(method, ...args) as Promise<unknown>
}

async function getSpansForTrace(traceId: string): Promise<Span[]> {
  const local = spans.value.filter(s => s.trace_id === traceId)
  if (local.length > 0) return local
  try {
    const remote = await rpcCall('get-spans', traceId)
    return Array.isArray(remote) ? (remote as Span[]) : local
  } catch {
    return local
  }
}

async function clearAllTraces() {
  try {
    await rpcCall('clear-traces')
  } catch {}
  traces.value = []
  spans.value = []
}

async function clearAllLogs() {
  try {
    await rpcCall('clear-logs')
  } catch {}
  logs.value = []
}

async function clearAllMetrics() {
  try {
    await rpcCall('clear-metrics')
  } catch {}
  metrics.value = []
}

function disconnect() {
  clearInterval(pollTimer)
  offSharedState?.()
}

export function useOtelStore() {
  return {
    traces,
    spans,
    logs,
    metrics,
    connected,
    error,
    connect,
    disconnect,
    getSpansForTrace,
    clearAllTraces,
    clearAllLogs,
    clearAllMetrics,
  }
}
