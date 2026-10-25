import { randomUUID } from 'node:crypto'
import type { HistogramData, Metric } from '../types.ts'
import { getAttributeValue, nanoToMs, parseAttributes } from './helper.ts'

export interface IKeyValue {
  key: string
  value: {
    stringValue?: string
    intValue?: string | number
    doubleValue?: number
    boolValue?: boolean
    arrayValue?: { values: IKeyValue['value'][] }
    kvlistValue?: { values: IKeyValue[] }
    bytesValue?: string
  }
}
interface IEvent {
  timeUnixNano: string
  name: string
  attributes?: IKeyValue[]
  droppedAttributesCount?: number
}

interface ILink {
  traceId: string
  spanId: string
  traceState?: string
  attributes?: IKeyValue[]
  droppedAttributesCount?: number
}

interface IStatus {
  message?: string
  code?: number
}

interface ISpan {
  traceId: string
  spanId: string
  traceState?: string
  parentSpanId?: string
  name: string
  kind: number
  startTimeUnixNano: string
  endTimeUnixNano: string
  attributes?: IKeyValue[]
  droppedAttributesCount?: number
  events?: IEvent[]
  droppedEventsCount?: number
  links?: ILink[]
  droppedLinksCount?: number
  status?: IStatus
}

interface IInstrumentationScope {
  name?: string
  version?: string
  attributes?: IKeyValue[]
  droppedAttributesCount?: number
}

interface IScopeSpans {
  scope?: IInstrumentationScope
  spans: ISpan[]
  schemaUrl?: string
}

interface IResource {
  attributes?: IKeyValue[]
  droppedAttributesCount?: number
}

interface IResourceSpans {
  resource?: IResource
  scopeSpans?: IScopeSpans[]
  schemaUrl?: string
}

export interface IExportTraceServiceRequest {
  resourceSpans: IResourceSpans[]
}

interface ILogRecord {
  timeUnixNano: string
  observedTimeUnixNano?: string
  severityNumber?: number
  severityText?: string
  body?: {
    stringValue?: string
    intValue?: string | number
    doubleValue?: number
    boolValue?: boolean
    arrayValue?: { values: unknown[] }
    kvlistValue?: { values: IKeyValue[] }
    bytesValue?: string
  }
  attributes?: IKeyValue[]
  droppedAttributesCount?: number
  traceId?: string
  spanId?: string
}

interface IScopeLogs {
  scope?: IInstrumentationScope
  logRecords: ILogRecord[]
  schemaUrl?: string
}

interface IResourceLogs {
  resource?: IResource
  scopeLogs?: IScopeLogs[]
  schemaUrl?: string
}

export interface IExportLogsServiceRequest {
  resourceLogs: IResourceLogs[]
}

interface INumberDataPoint {
  timeUnixNano: string
  asDouble?: number
  asInt?: string | number
  attributes?: IKeyValue[]
  droppedAttributesCount?: number
}

interface IHistogramDataPoint {
  timeUnixNano: string
  count?: string | number
  sum?: string | number
  min?: string | number
  max?: string | number
  explicitBounds?: number[]
  bucketCounts?: Array<string | number>
  attributes?: IKeyValue[]
  droppedAttributesCount?: number
}

interface IMetric {
  name: string
  description?: string
  unit?: string
  sum?: {
    isMonotonic?: boolean
    aggregationTemporality?: number
    dataPoints: INumberDataPoint[]
  }
  gauge?: {
    dataPoints: INumberDataPoint[]
  }
  histogram?: {
    aggregationTemporality?: number
    dataPoints: IHistogramDataPoint[]
  }
  summary?: {
    dataPoints: unknown[]
  }
  exponentialHistogram?: {
    dataPoints: unknown[]
  }
}

interface IScopeMetrics {
  scope?: IInstrumentationScope
  metrics: IMetric[]
  schemaUrl?: string
}

interface IResourceMetrics {
  resource?: IResource
  scopeMetrics?: IScopeMetrics[]
  schemaUrl?: string
}

export interface IExportMetricsServiceRequest {
  resourceMetrics: IResourceMetrics[]
}

// Output types
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

export interface ParsedLogsResult {
  logs: Log[]
}

export interface TraceResult {
  traces: Trace[]
  spans: Span[]
}
export function parseOTLPTrace(otlpData: IExportTraceServiceRequest): TraceResult {
  const traces = new Map<string, Trace>()
  const spans: Span[] = []

  for (const resourceSpan of otlpData.resourceSpans) {
    const resourceAttrs = parseAttributes(resourceSpan.resource?.attributes)
    const serviceName = (resourceAttrs['service.name'] as string) || 'unknown'

    for (const scopeSpan of resourceSpan.scopeSpans || []) {
      for (const otlpSpan of scopeSpan.spans) {
        const traceId = otlpSpan.traceId
        const spanId = otlpSpan.spanId
        const parentSpanId = otlpSpan.parentSpanId ?? null

        const startTime = nanoToMs(otlpSpan.startTimeUnixNano)
        const endTime = nanoToMs(otlpSpan.endTimeUnixNano)
        const duration = endTime - startTime

        const attributes = parseAttributes(otlpSpan.attributes)
        const statusCode = otlpSpan.status?.code || 0
        const statusMessage = otlpSpan.status?.message || null

        // Parse events
        const events = (otlpSpan.events || []).map(event => ({
          time: nanoToMs(event.timeUnixNano),
          name: event.name,
          attributes: parseAttributes(event.attributes),
        }))

        // Parse links
        const links = (otlpSpan.links || []).map(link => ({
          traceId: link.traceId,
          spanId: link.spanId,
          traceState: link.traceState,
          attributes: parseAttributes(link.attributes),
        }))

        // Track trace metadata
        if (!traces.has(traceId)) {
          traces.set(traceId, {
            trace_id: traceId,
            service_name: serviceName,
            operation_name: otlpSpan.name,
            start_time: startTime,
            end_time: endTime,
            duration: duration,
            status_code: statusCode,
            status_message: statusMessage,
          })
        } else {
          // Update trace timing if this span extends it
          const trace = traces.get(traceId)!
          if (startTime < trace.start_time) trace.start_time = startTime
          if (endTime > trace.end_time) {
            trace.end_time = endTime
            trace.duration = trace.end_time - trace.start_time
          }
          // Update status if error (ERROR = 2)
          if (statusCode === 2 && trace.status_code !== 2) {
            trace.status_code = statusCode
            trace.status_message = statusMessage
          }
        }

        // Store span
        spans.push({
          span_id: spanId,
          trace_id: traceId,
          parent_span_id: parentSpanId,
          name: otlpSpan.name,
          kind: otlpSpan.kind > 0 ? otlpSpan.kind - 1 : 0,
          start_time: startTime,
          end_time: endTime,
          duration: duration,
          status_code: statusCode,
          status_message: statusMessage,
          attributes,
          events,
          links,
        })
      }
    }
  }

  // Update trace operation names to use root span names
  for (const trace of traces.values()) {
    const traceSpans = spans.filter(s => s.trace_id === trace.trace_id)
    const spanMap = new Map(traceSpans.map(s => [s.span_id, s]))

    // Find root span (no parent or parent not in this trace)
    const rootSpan = traceSpans.find(s => !s.parent_span_id || !spanMap.has(s.parent_span_id))

    if (rootSpan) {
      trace.operation_name = rootSpan.name
    }
  }

  return {
    traces: Array.from(traces.values()),
    spans,
  }
}

function getLogBodyValue(body?: ILogRecord['body']): string {
  if (!body) return ''

  if (body.stringValue !== undefined) return body.stringValue
  if (body.intValue !== undefined) return String(body.intValue)
  if (body.doubleValue !== undefined) return String(body.doubleValue)
  if (body.boolValue !== undefined) return String(body.boolValue)
  if (body.arrayValue !== undefined) {
    return JSON.stringify(body.arrayValue.values.map(v => getAttributeValue(v as IKeyValue['value'])))
  }
  if (body.kvlistValue !== undefined) {
    return JSON.stringify(parseAttributes(body.kvlistValue.values))
  }
  if (body.bytesValue !== undefined) return body.bytesValue

  return ''
}

export function parseOTLPLog(otlpData: IExportLogsServiceRequest) {
  const logs: Log[] = []

  for (const resourceLog of otlpData.resourceLogs) {
    const resourceAttrs = parseAttributes(resourceLog.resource?.attributes)
    const serviceName = (resourceAttrs['service.name'] as string) || 'unknown'

    for (const scopeLog of resourceLog.scopeLogs || []) {
      for (const logRecord of scopeLog.logRecords) {
        const timestamp = nanoToMs(logRecord.timeUnixNano)
        const traceId = logRecord.traceId ?? null
        const spanId = logRecord.spanId ?? null

        const severityNumber = logRecord.severityNumber || 9 // Default to INFO
        const severityText = logRecord.severityText || null
        const body = getLogBodyValue(logRecord.body)
        const attributes = parseAttributes(logRecord.attributes)

        logs.push({
          log_id: randomUUID(),
          timestamp,
          trace_id: traceId,
          span_id: spanId,
          severity_number: severityNumber,
          severity_text: severityText,
          body,
          service_name: serviceName,
          attributes,
        })
      }
    }
  }

  return { logs }
}

function getMetricValue(dataPoint: INumberDataPoint): number | null {
  return dataPoint.asInt !== undefined ? Number(dataPoint.asInt) : (dataPoint.asDouble ?? null)
}

function getHistogramData(dataPoint: IHistogramDataPoint): HistogramData {
  return {
    buckets: (dataPoint.explicitBounds || []).map((bound, index) => ({
      bound,
      count: Number(dataPoint.bucketCounts?.[index] ?? 0),
    })),
    sum: Number(dataPoint.sum ?? 0),
    count: Number(dataPoint.count ?? 0),
    min: Number(dataPoint.min ?? 0),
    max: Number(dataPoint.max ?? 0),
  }
}

export function parseOTLPMetrics(otlpData: IExportMetricsServiceRequest): { metrics: Metric[] } {
  const metrics: Metric[] = []

  for (const resourceMetric of otlpData.resourceMetrics) {
    const resourceAttrs = parseAttributes(resourceMetric.resource?.attributes)
    const serviceName = (resourceAttrs['service.name'] as string) || 'unknown'

    for (const scopeMetric of resourceMetric.scopeMetrics || []) {
      for (const otlpMetric of scopeMetric.metrics) {
        const description = otlpMetric.description || null
        const unit = otlpMetric.unit || null

        if (otlpMetric.sum) {
          const type: Metric['type'] = otlpMetric.sum.isMonotonic ? 'counter' : 'gauge'
          for (const dataPoint of otlpMetric.sum.dataPoints) {
            metrics.push({
              metric_id: randomUUID(),
              name: otlpMetric.name,
              description,
              unit,
              type,
              service_name: serviceName,
              timestamp: nanoToMs(dataPoint.timeUnixNano),
              value: getMetricValue(dataPoint),
              histogram: null,
              attributes: parseAttributes(dataPoint.attributes),
            })
          }
          continue
        }

        if (otlpMetric.gauge) {
          for (const dataPoint of otlpMetric.gauge.dataPoints) {
            metrics.push({
              metric_id: randomUUID(),
              name: otlpMetric.name,
              description,
              unit,
              type: 'gauge',
              service_name: serviceName,
              timestamp: nanoToMs(dataPoint.timeUnixNano),
              value: getMetricValue(dataPoint),
              histogram: null,
              attributes: parseAttributes(dataPoint.attributes),
            })
          }
          continue
        }

        if (otlpMetric.histogram) {
          for (const dataPoint of otlpMetric.histogram.dataPoints) {
            metrics.push({
              metric_id: randomUUID(),
              name: otlpMetric.name,
              description,
              unit,
              type: 'histogram',
              service_name: serviceName,
              timestamp: nanoToMs(dataPoint.timeUnixNano),
              value: null,
              histogram: getHistogramData(dataPoint),
              attributes: parseAttributes(dataPoint.attributes),
            })
          }
        }
      }
    }
  }

  return { metrics }
}
