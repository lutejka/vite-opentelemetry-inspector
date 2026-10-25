import type { Metric, MetricType } from '../../src/types.ts'

export interface MetricGroup {
  name: string
  type: MetricType
  description: string | null
  unit: string | null
  /** metricPointValue of the newest data point; null when it has no numeric value. */
  latestValue: number | null
  /** Chronological (oldest first) non-null point values, for sparklines. */
  sparklineValues: number[]
  /** All data points of this name, newest first. */
  dataPoints: Metric[]
}

export function metricPointValue(metric: Metric): number | null {
  if (metric.type === 'histogram') {
    if (!metric.histogram || metric.histogram.count === 0) return null
    return metric.histogram.sum / metric.histogram.count
  }
  return metric.value
}

export function groupMetrics(metrics: Metric[]): MetricGroup[] {
  const byName = new Map<string, Metric[]>()
  for (const metric of metrics) {
    const bucket = byName.get(metric.name)
    if (bucket) {
      bucket.push(metric)
    } else {
      byName.set(metric.name, [metric])
    }
  }

  const groups: MetricGroup[] = []
  for (const [name, dataPoints] of byName) {
    dataPoints.sort((a, b) => b.timestamp - a.timestamp)
    const newest = dataPoints[0]!
    groups.push({
      name,
      type: newest.type,
      description: newest.description,
      unit: newest.unit,
      latestValue: metricPointValue(newest),
      sparklineValues: dataPoints
        .map(metricPointValue)
        .filter((value): value is number => value !== null)
        .reverse(),
      dataPoints,
    })
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name))
}

export function metricStats(dataPoints: Metric[]): { min: number; max: number; avg: number } | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let sum = 0
  let count = 0
  for (const dataPoint of dataPoints) {
    const value = metricPointValue(dataPoint)
    if (value === null) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
    sum += value
    count++
  }
  if (count === 0) return null
  return { min, max, avg: sum / count }
}
