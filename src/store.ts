import type { Log, Span, Trace } from './types.ts'

/**
 * Framework-free in-memory telemetry store.
 *
 * Ported from `nuxt-otel/src/runtime/store/index.ts`. The original used
 * `globalThis.__nuxtOtel*` singletons + a `__nuxtOtelRpcBroadcast` hook.
 * Here each `createOtelStore()` owns its arrays, and notifies subscribers
 * (the devframe shared-state flush in `devtools.ts`) via listeners.
 */

export interface OtelStore {
  getTraces(): Trace[]
  getSpans(traceId?: string): Span[]
  getLogs(): Log[]
  getTrace(traceId: string): { trace: Trace | null, spans: Span[] }
  addTraces(traces: Trace[]): void
  addSpans(spans: Span[]): void
  addLogs(logs: Log[]): void
  clearTraces(): void
  clearLogs(): void
  onChange(listener: () => void): () => void
}

export function createOtelStore(): OtelStore {
  let traces: Trace[] = []
  let spans: Span[] = []
  let logs: Log[] = []
  const listeners = new Set<() => void>()

  function emit() {
    for (const listener of listeners) {
      try {
        listener()
      }
      catch {
        // ignore listener errors during dev restarts
      }
    }
  }

  return {
    getTraces: () => traces,
    getSpans: traceId => (traceId ? spans.filter(s => s.trace_id === traceId) : spans),
    getLogs: () => logs,
    getTrace(traceId) {
      return {
        trace: traces.find(t => t.trace_id === traceId) ?? null,
        spans: spans.filter(s => s.trace_id === traceId),
      }
    },
    addSpans(newSpans) {
      const existing = new Set(spans.map(s => s.span_id))
      const fresh = newSpans.filter(s => !existing.has(s.span_id))
      if (fresh.length === 0) return
      spans = [...spans, ...fresh]
      emit()
    },
    addTraces(newTraces) {
      const existing = new Set(traces.map(t => t.trace_id))
      const fresh = newTraces.filter(t => !existing.has(t.trace_id))
      if (fresh.length === 0) return
      traces = [...traces, ...fresh]
      emit()
    },
    addLogs(newLogs) {
      const existing = new Set(logs.map(l => l.log_id))
      const fresh = newLogs.filter(l => !existing.has(l.log_id))
      if (fresh.length === 0) return
      logs = [...logs, ...fresh]
      emit()
    },
    clearTraces() {
      traces = []
      spans = []
      emit()
    },
    clearLogs() {
      logs = []
      emit()
    },
    onChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
