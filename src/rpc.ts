import { defineRpcFunction } from 'devframe'
import type { defineRpcFunction as defineRpcFunctionType } from 'devframe'
import { OtelStore } from './store'

export const getRpcs = (store: OtelStore) => {
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
    handler: (traceId?: string) => store.getLogs(traceId),
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

  const clearTraces = defineRpcFunction({
    name: 'clear-traces',
    type: 'action',
    jsonSerializable: true,
    handler: () => {
      store.clearTraces()
    },
  })

  const clearLogs = defineRpcFunction({
    name: 'clear-logs',
    type: 'action',
    jsonSerializable: true,
    handler: () => {
      store.clearLogs()
    },
  })

  const clearMetrics = defineRpcFunction({
    name: 'clear-metrics',
    type: 'action',
    jsonSerializable: true,
    handler: () => {
      store.clearMetrics()
    },
  })

  return [
    getTraces,
    getTrace,
    getSpans,
    getLogs,
    getMetrics,
    clearTraces,
    clearLogs,
    clearMetrics,
  ]
}
