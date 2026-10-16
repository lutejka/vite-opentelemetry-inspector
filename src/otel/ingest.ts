import { parseOTLPLog, parseOTLPTrace } from './parser.ts'
import type { createOtelStore } from '../store.ts'

/** Minimal OTLP JSON ingest: accepts `/v1/traces` and `/v1/logs` payloads (or a merged body). */
export function ingestOtlpBody(store: ReturnType<typeof createOtelStore>, body: any): void {
  if (!body || typeof body !== 'object') return
  if (Array.isArray(body.resourceSpans)) {
    const { spans, traces } = parseOTLPTrace(body)
    store.addTraces(traces)
    store.addSpans(spans)
  }
  if (Array.isArray(body.resourceLogs)) {
    const { logs } = parseOTLPLog(body)
    store.addLogs(logs)
  }
}

/** Shared prefix for the plugin's internal endpoints (ingest + devframe base). */
export const DEVFRAME_ID = 'opentelemetry'
export const INGEST_PATH = '/__opentelemetry-ingest'

/**
 * Returns `true` for internal routes that observability SDKs should exclude
 * from tracing to avoid circular spans and noise.
 */
export function isInternalRoute(path: string): boolean {
  return path.startsWith('/__opentelemetry') || path.startsWith('/__otel')
}
