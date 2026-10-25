import type { createOtelStore } from '../store.ts'
import { parseOTLPLog, parseOTLPMetrics, parseOTLPTrace } from './parser.ts'

/** Minimal OTLP JSON ingest: accepts `/v1/traces`, `/v1/logs` and `/v1/metrics` payloads (or a merged body). */
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
  if (Array.isArray(body.resourceMetrics)) {
    const { metrics } = parseOTLPMetrics(body)
    store.addMetrics(metrics)
  }
}

/**
 * True when a request path targets the ingest endpoint: either the endpoint
 * itself or an OTLP per-signal sub-path beneath it (`<ingestPath>/v1/traces`,
 * `<ingestPath>/v1/logs`, `<ingestPath>/v1/metrics`).
 *
 * A trailing slash in `ingestPath` is ignored. The root path (`/`) matches only
 * itself, so configuring it cannot turn the endpoint into a catch-all.
 *
 * @param path - Request pathname (query string already stripped).
 * @param ingestPath - Configured ingest endpoint path.
 */
export function matchesIngestPath(path: string, ingestPath: string): boolean {
  const base = ingestPath.replace(/\/+$/, '')
  if (!base) {
    return path === ingestPath
  }
  return path === base || path.startsWith(`${base}/`)
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
