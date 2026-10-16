import type { Span } from '~shared/types'

export interface TraceBounds {
  traceStart: number
  traceEnd: number
  traceDuration: number
}

export function getTraceBounds(spans: Span[]): TraceBounds {
  const spanMap = new Map<string, Span>()
  for (const span of spans) {
    spanMap.set(span.span_id, span)
  }

  const rootSpans = spans.filter(span => !span.parent_span_id || !spanMap.has(span.parent_span_id))
  rootSpans.sort((a, b) => a.start_time - b.start_time)

  const traceStart = rootSpans[0]?.start_time ?? 0
  const traceEnd = spans.reduce((max, span) => Math.max(max, span.end_time), 0)
  const traceDuration = Math.max(traceEnd - traceStart, 1)

  return { traceStart, traceEnd, traceDuration }
}
