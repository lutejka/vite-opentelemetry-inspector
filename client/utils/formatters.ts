import { SpanKind } from '@opentelemetry/api'

export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}µs`
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`
  } else {
    return `${(ms / 1000).toFixed(2)}s`
  }
}

export function formatDurationCompact(ms: number): string {
  if (ms === 0) return '0ms'
  if (ms < 1) {
    const val = ms * 1000
    return `${Number.parseFloat(val.toFixed(1))}µs`
  } else if (ms < 1000) {
    return `${Number.parseFloat(ms.toFixed(1))}ms`
  } else {
    return `${Number.parseFloat((ms / 1000).toFixed(1))}s`
  }
}

export function getSpanKindLabel(kind: SpanKind): string {
  const kinds: Record<SpanKind, string> = {
    [SpanKind.INTERNAL]: 'Internal',
    [SpanKind.SERVER]: 'Server',
    [SpanKind.CLIENT]: 'Client',
    [SpanKind.PRODUCER]: 'Producer',
    [SpanKind.CONSUMER]: 'Consumer',
  }
  return kinds[kind] || 'Unspecified'
}
