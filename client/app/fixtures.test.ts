import { describe, expect, it } from 'vitest'
import { createLiveMetricTick } from './fixtures'

describe('createLiveMetricTick', () => {
  const now = 1_700_000_000_000

  it('adds one fresh point to each fixture series', () => {
    const tick = createLiveMetricTick(now)
    expect(tick.map(metric => metric.name).sort()).toEqual([
      'http.requests.total',
      'http.server.duration',
      'process.memory.heap',
    ])
    expect(tick.every(metric => metric.timestamp === now)).toBe(true)
    expect(new Set(tick.map(metric => metric.metric_id)).size).toBe(tick.length)
  })

  it('keeps histogram counts equal to the bucket sum', () => {
    const histogram = createLiveMetricTick(now).find(metric => metric.type === 'histogram')!.histogram!
    expect(histogram.count).toBe(histogram.buckets.reduce((sum, bucket) => sum + bucket.count, 0))
  })

  it('varies the gauge and counter so charts visibly move', () => {
    const valueOf = (at: number, name: string) => createLiveMetricTick(at).find(metric => metric.name === name)!.value
    const offsets = [0, 2_500, 5_000, 7_500]
    expect(new Set(offsets.map(offset => valueOf(now + offset, 'process.memory.heap'))).size).toBeGreaterThan(1)
    expect(new Set(offsets.map(offset => valueOf(now + offset, 'http.requests.total'))).size).toBeGreaterThan(1)
  })

  it('produces unique ids for every tick', () => {
    const first = createLiveMetricTick(now).map(metric => metric.metric_id)
    const second = createLiveMetricTick(now).map(metric => metric.metric_id)
    expect(new Set([...first, ...second]).size).toBe(first.length + second.length)
  })
})
