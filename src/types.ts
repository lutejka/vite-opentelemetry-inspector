/**
 * Shared telemetry types for the devframe node side and the client UI.
 *
 * Ported from `nuxt-otel` (`shared/types.ts` + `src/runtime/otel/parse/parser.ts`).
 * Keep in sync with the OTLP parser output.
 */

export interface Span {
  span_id: string
  trace_id: string
  parent_span_id: string | null
  name: string
  kind: number
  start_time: number
  end_time: number
  duration: number
  status_code: number
  status_message: string | null
  attributes: Record<string, unknown>
  events: Array<{
    time: number
    name: string
    attributes: Record<string, unknown>
  }>
  links: Array<{
    traceId: string
    spanId: string
    traceState?: string
    attributes: Record<string, unknown>
  }>
}

export interface Trace {
  trace_id: string
  service_name: string
  operation_name: string
  start_time: number
  end_time: number
  duration: number
  status_code: number
  status_message: string | null
}

export interface Log {
  log_id: string
  timestamp: number
  trace_id: string | null
  span_id: string | null
  severity_number: number
  severity_text: string | null
  body: string
  service_name: string
  attributes: Record<string, unknown>
}

export type MetricType = 'counter' | 'gauge' | 'histogram'

export interface HistogramData {
  buckets: { bound: number; count: number }[]
  sum: number
  count: number
  min: number
  max: number
}

export interface Metric {
  metric_id: string
  name: string
  description: string | null
  unit: string | null
  type: MetricType
  service_name: string
  timestamp: number
  value: number | null
  histogram: HistogramData | null
  attributes: Record<string, unknown>
}
