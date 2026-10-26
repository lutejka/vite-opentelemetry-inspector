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
  /** Chronological, type-aware aggregate across all series of this name. */
  samples: MetricSample[]
  /** Number of distinct service + attribute series in this group. */
  seriesCount: number
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

export interface MetricSample {
  value: number
  timestamp: number
}

/** One aggregated series within a metric group (e.g. one route, one event-loop state). */
export interface MetricSeries {
  key: string
  label: string
  samples: MetricSample[]
}

/** Latest sample and full history for one concrete series. */
export interface MetricSeriesLatest {
  key: string
  label: string
  value: number
  values: number[]
  samples: MetricSample[]
}

/**
 * Chronological (oldest first) samples with a numeric value, paired with their
 * timestamps. Input is expected newest-first, matching `MetricGroup.dataPoints`.
 */
export function metricSamples(dataPoints: readonly Metric[]): MetricSample[] {
  const samples: MetricSample[] = []
  for (let index = dataPoints.length - 1; index >= 0; index--) {
    const dataPoint = dataPoints[index]!
    const value = metricPointValue(dataPoint)
    if (value !== null) samples.push({ value, timestamp: dataPoint.timestamp })
  }
  return samples
}

/**
 * Type-aware per-timestamp aggregate over every series of one metric name.
 *
 * Counters sum, gauges average, histograms use the count-weighted mean
 * (`Σsum / Σcount`). Timestamps are returned ascending and timestamps with no
 * numeric value are dropped.
 */
export function aggregateSamples(dataPoints: readonly Metric[]): MetricSample[] {
  if (dataPoints.length === 0) return []

  const sorted = [...dataPoints].sort((a, b) => a.timestamp - b.timestamp)
  const groupType = sorted[sorted.length - 1]!.type
  const byTimestamp = new Map<number, Metric[]>()
  for (const point of sorted) {
    const bucket = byTimestamp.get(point.timestamp)
    if (bucket) bucket.push(point)
    else byTimestamp.set(point.timestamp, [point])
  }

  const samples: MetricSample[] = []
  for (const [timestamp, points] of byTimestamp) {
    const value = aggregateTimestamp(points, groupType)
    if (value !== null) samples.push({ timestamp, value })
  }
  return samples
}

/** Min/max/avg over already-aggregated samples; null for empty input. */
export function sampleStats(
  samples: readonly MetricSample[],
): { min: number; max: number; avg: number } | null {
  if (samples.length === 0) return null

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let sum = 0
  for (const sample of samples) {
    min = Math.min(min, sample.value)
    max = Math.max(max, sample.value)
    sum += sample.value
  }
  return { min, max, avg: sum / samples.length }
}

/**
 * Merge histograms by bucket bound, summing bucket counts and the sum/count
 * fields. Min/max come from the non-empty histograms; 0 when none.
 */
export function mergeHistograms(histograms: readonly HistogramData[]): HistogramData | null {
  if (histograms.length === 0) return null

  const counts = new Map<number, number>()
  let sum = 0
  let count = 0
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const histogram of histograms) {
    for (const bucket of histogram.buckets) {
      counts.set(bucket.bound, (counts.get(bucket.bound) ?? 0) + bucket.count)
    }
    sum += histogram.sum
    count += histogram.count
    if (histogram.count > 0) {
      min = Math.min(min, histogram.min)
      max = Math.max(max, histogram.max)
    }
  }

  return {
    buckets: [...counts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([bound, bucketCount]) => ({ bound, count: bucketCount })),
    sum,
    count,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
  }
}

/**
 * Attribute keys with at least two distinct values in the input, sorted.
 * Missing values count as a distinct `(none)` value. These are the useful
 * breakdown choices for the dialog.
 */
export function breakdownKeys(dataPoints: readonly Metric[]): string[] {
  const values = new Map<string, Set<string>>()
  for (const point of dataPoints) {
    for (const [key, value] of Object.entries(point.attributes ?? {})) {
      const set = values.get(key) ?? new Set<string>()
      set.add(value == null ? '(none)' : String(value))
      values.set(key, set)
    }
  }

  for (const [key, set] of values) {
    if (dataPoints.some(point => point.attributes?.[key] == null)) set.add('(none)')
  }

  return [...values.entries()]
    .filter(([, set]) => set.size >= 2)
    .map(([key]) => key)
    .sort()
}

/**
 * Split points by one attribute value and aggregate each group per timestamp.
 * `null` returns the single aggregate series. Missing values become `(none)`.
 */
export function breakdownSeries(dataPoints: readonly Metric[], attribute: string | null): MetricSeries[] {
  if (attribute === null) {
    return [{ key: '', label: '', samples: aggregateSamples(dataPoints) }]
  }

  const groups = new Map<string, Metric[]>()
  for (const point of dataPoints) {
    const raw = point.attributes?.[attribute]
    const key = raw == null ? '(none)' : raw === '' ? '(empty)' : String(raw)
    const bucket = groups.get(key)
    if (bucket) bucket.push(point)
    else groups.set(key, [point])
  }

  return [...groups.entries()]
    .map(([key, points]) => ({
      key,
      label: `${attribute}=${key}`,
      samples: aggregateSamples(points),
    }))
    .filter(series => series.samples.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Number of distinct service + attribute series in the input. */
export function metricSeriesCount(dataPoints: readonly Metric[]): number {
  return new Set(dataPoints.map(metricSeriesKey)).size
}

/**
 * Latest value and chronological history for every concrete series. Used by the
 * gauge series selector so a gauge always displays a real sample.
 */
export function latestSeries(dataPoints: readonly Metric[]): MetricSeriesLatest[] {
  const groups = new Map<string, Metric[]>()
  for (const point of dataPoints) {
    const key = metricSeriesKey(point)
    const bucket = groups.get(key)
    if (bucket) bucket.push(point)
    else groups.set(key, [point])
  }

  const multipleServices = new Set(dataPoints.map(point => point.service_name)).size > 1
  const series: MetricSeriesLatest[] = []
  for (const [key, points] of groups) {
    const samples = aggregateSamples(points)
    const latest = samples.at(-1)
    if (!latest) continue

    const first = points[0]!
    const attributeLabel = Object.entries(first.attributes ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}=${value}`)
      .join(', ')
    const label = multipleServices && attributeLabel
      ? `${first.service_name} · ${attributeLabel}`
      : (attributeLabel || first.service_name)

    series.push({
      key,
      label,
      value: latest.value,
      values: samples.map(sample => sample.value),
      samples,
    })
  }

  return series.sort((a, b) => a.label.localeCompare(b.label))
}

function aggregateTimestamp(points: readonly Metric[], groupType: MetricType): number | null {
  const histograms = points.filter(
    point => point.type === 'histogram' && point.histogram && point.histogram.count > 0,
  )

  if (histograms.length === points.length && histograms.length > 0) {
    return weightedHistogramMean(histograms)
  }

  const values: number[] = []
  for (const point of points) {
    if (point.type === 'histogram') continue
    const value = metricPointValue(point)
    if (value !== null) values.push(value)
  }

  if (values.length === 0) {
    return histograms.length > 0 ? weightedHistogramMean(histograms) : null
  }

  const sum = values.reduce((total, value) => total + value, 0)
  return groupType === 'counter' ? sum : sum / values.length
}

function weightedHistogramMean(points: readonly Metric[]): number | null {
  let sum = 0
  let count = 0
  for (const point of points) {
    const histogram = point.histogram
    if (!histogram || histogram.count <= 0) continue
    sum += histogram.sum
    count += histogram.count
  }
  return count === 0 ? null : sum / count
}

function metricSeriesKey(metric: Metric): string {
  const attributes = Object.entries(metric.attributes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify([metric.service_name, attributes])
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
    const samples = aggregateSamples(dataPoints)
    const latestSample = samples.at(-1) ?? null
    const newestTimestamp = newest.timestamp
    const newestHistograms = dataPoints
      .filter(point => point.timestamp === newestTimestamp && point.histogram)
      .map(point => point.histogram!)
    groups.push({
      name,
      type: newest.type,
      description: newest.description,
      unit: newest.unit,
      latestValue: latestSample?.value ?? null,
      latestHistogram: newestHistograms.length > 0 ? mergeHistograms(newestHistograms) : null,
      sparklineValues: samples.map(sample => sample.value),
      samples,
      seriesCount: metricSeriesCount(dataPoints),
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
    && (!needle || group.name.toLowerCase().includes(needle))
  )
}

export function metricStats(dataPoints: Metric[]): { min: number; max: number; avg: number } | null {
  return sampleStats(aggregateSamples(dataPoints))
}
