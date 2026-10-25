import { describe, expect, it } from 'vitest'
import { createOpentelemetryDevframe } from '../src/devtools'

describe('createOpentelemetryDevframe', () => {
  it('exposes a devframe definition with client assets and dock metadata', () => {
    const { definition } = createOpentelemetryDevframe()
    expect(definition.id).toBe('opentelemetry')
    expect(definition.name).toBe('OpenTelemetry')
    expect(definition.capabilities).toEqual({ build: false })
    expect(definition.clientAssets).toContain('devtools-client')
  })

  it('buffers telemetry before setup via expose* helpers', () => {
    const devframe = createOpentelemetryDevframe()
    expect(() => {
      devframe.exposeTraces([{
        trace_id: 't1',
        service_name: 's',
        operation_name: 'op',
        start_time: 1,
        end_time: 2,
        duration: 1,
        status_code: 0,
        status_message: null,
      }])
      devframe.exposeSpans([])
      devframe.exposeLogs([])
      devframe.ingest({ resourceLogs: [] })
    }).not.toThrow()
  })

  it('buffers metrics before setup via exposeMetrics', () => {
    const devframe = createOpentelemetryDevframe()
    expect(() => {
      devframe.exposeMetrics([{
        metric_id: 'm1',
        name: 'test.metric',
        description: null,
        unit: null,
        type: 'gauge',
        service_name: 'demo',
        timestamp: 1,
        value: 1,
        histogram: null,
        attributes: {},
      }])
    }).not.toThrow()
  })
})
