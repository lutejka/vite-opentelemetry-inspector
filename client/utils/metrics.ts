import type { HistogramData, Metric, MetricType } from '../../src/types.ts'

export interface MetricGroup {
  name: string
  type: MetricType
  description: string | null
  unit: string | null
  /** metricPointValue of the newest data point; null when it has no numeric value. */
  latestValue: number | null
  /** Newest data point's histogram, when it is a histogram; null otherwise. */
  latestHistogram: HistogramData | null
  /** Chronological (oldest first) non-null point values, for sparklines. */
  sparklineValues: number[]
  /** All data points of this name, newest first. */
  dataPoints: Metric[]
}

/** One bar of a histogram chart: the range of values it counts. */
export interface HistogramBar {
  /** Inclusive lower bound; `null` for the underflow bucket (−∞). */
  from: number | null
  /** Inclusive upper bound; `null` for the implied overflow bucket (+∞). */
  to: number | null
  count: number
}

/**
 * Turn an OTLP histogram's bucket counts into drawable ranges.
 *
 * `buckets` hold ascending upper bounds (`explicitBounds[i]` ↔ `bucketCounts[i]`),
 * so each bar spans the previous bound to its own. Samples above the last stored
 * bound are dropped by the parser; when `histogram.count` exceeds the sum of the
 * stored bucket counts, the difference becomes a final `+∞` bar.
 *
 * @param histogram - Parsed histogram data point.
 * @returns Bucket ranges in ascending order, empty when the point has no bounds.
 */
export function histogramBars(histogram: HistogramData): HistogramBar[] {
  const bars: HistogramBar[] = histogram.buckets.map((bucket, index) => ({
    from: index === 0 ? null : histogram.buckets[index - 1]!.bound,
    to: bucket.bound,
    count: bucket.count,
  }))

  if (bars.length > 0) {
    const stored = bars.reduce((total, bar) => total + bar.count, 0)
    const overflow = histogram.count - stored
    if (overflow > 0) {
      bars.push({ from: bars.at(-1)!.to, to: null, count: overflow })
    }
  }

  return bars
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
      latestHistogram: newest.histogram ?? null,
      sparklineValues: dataPoints
        .map(metricPointValue)
        .filter((value): value is number => value !== null)
        .reverse(),
      dataPoints,
    })
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name))
}

export type MetricTypeFilter = 'all' | MetricType

/** Apply the metrics-page search and type filters to grouped metrics. */
export function filterMetricGroups(
  groups: readonly MetricGroup[],
  query: string,
  type: MetricTypeFilter,
): MetricGroup[] {
  const needle = query.toLowerCase().trim()
  return groups.filter(group =>
    (type === 'all' || group.type === type)
    && (!needle || group.name.toLowerCase().includes(needle)),
  )
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
