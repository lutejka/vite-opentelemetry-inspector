# Metric Series Aggregation & Breakdown — Design

**Status:** Proposed (planning only, not implemented)

## Problem

Metrics are grouped by `name` only (`groupMetrics` in `client/utils/metrics.ts`). OTLP
emits one data point per attribute set per export, and every attribute set in an export
shares the same `timeUnixNano`. The chart therefore receives several points with the same
x but different y, and `polylinePath` connects them alternately. The result is a
full-height sawtooth, not a line.

Verified against live data on 2026-10-26 (nuxt-otel MCP):

| metric | type | series per timestamp |
| --- | --- | --- |
| `http.server.request.duration` | histogram | 2 (`http.route`) |
| `nodejs.eventloop.time` | counter | 2 (`nodejs.eventloop.state=active/idle`) |
| `v8js.memory.heap.used` | gauge | 13 (`v8js.heap.space.name`) |
| `v8js.resource.active` | gauge | 3 |
| `v8js.gc.duration` | histogram | 3 |

Example: at one timestamp, `nodejs.eventloop.time` reports `active=1.56 s` and
`idle=25.05 s`. No value is zero. The compact sparkline normalizes the min/max of the
interleaved set to its full height, which makes the smaller value look like zero.

The same mixing also makes `latestValue`, Min/Max/Avg, `sparklineValues`, and
`latestHistogram` arbitrary or misleading.

## Goals

1. Browse tiles show one aggregate line per metric family, using a type-aware aggregation.
2. The chart dialog can optionally break the line down by **one attribute key**, with one
   line per value, a legend, and per-series hover values. No query editor or PromQL.
3. `latestValue`, `sparklineValues`, stats, and the histogram distribution reflect the
   aggregate rather than one arbitrary point.
4. Single-series metrics keep their current appearance and behavior.

## Non-goals

- PromQL or a query editor.
- Multi-key breakdown (e.g. route × status) in this change.
- Counter rate conversion. Raw counter values stay raw; only the cross-series aggregation
  changes.
- Breakdown by service. Attribute keys only; service breakdown can be added later.
- Adding a Vue component test dependency. Pure utilities are tested with vitest; SVG
  behavior is verified manually in the dev client.

## Aggregation Rules

For one metric name, group points by `timestamp`, then aggregate:

| Metric type | Aggregate |
| --- | --- |
| counter | `sum(values)` |
| gauge | `mean(values)` (for the plotted line; see **Open Decision: Gauge display**) |
| histogram | `sum(histogram.sum) / sum(histogram.count)`; `null` when the combined count is 0 |
| mixed | if every point at the timestamp is a histogram, use the histogram rule; otherwise use the newest point's type (`counter` sums, everything else means) |

- `null` values and zero-count histograms are ignored.
- Timestamps are sorted ascending before output.
- If a metric has one point per timestamp, the output is identical to today.

## Gauge display (option A)

A gauge widget is inherently a single sample, but a multi-series gauge has one current
value per series (e.g. `v8js.memory.heap.used` has 13 heap spaces). Reusing the line
aggregate (`mean`) for the gauge headline would display a synthetic number, not a reported
sample.

**Decision: A. Selected series.**

- A multi-series gauge in the dialog gets a **series selector**; the gauge value, gauge
  scale, and the `Latest`/Min/Max/Avg stats use the selected series' own latest sample and
  history. Default: the first series sorted by label. The history line follows that selected
  series; the breakdown select also offers `All series (aggregate)` for the cross-series mean.
- The tile has no selector, so a multi-series gauge shows `N series` instead of a single
  number and hides the single-value gauge widget and sparkline; the dialog is where the
  detail lives.
- Single-series gauges are unchanged: one series, so the gauge is already a real sample.
- Counters and histograms keep the aggregate latest value (`sum` / weighted mean), which is
  meaningful on its own.

This needs `latestSeries(dataPoints): MetricSeriesLatest[]` (per-series label, latest value,
and chronological values for the scale).

## Breakdown Behavior

- The dialog lists attribute keys that have **at least two distinct values** in the
  collected points, sorted alphabetically. `None` (aggregate) is the default.
- Selecting `attribute` groups points by `String(attributes[attribute])`, with missing
  values grouped under `(none)`.
- Each group is aggregated with the rules above (a single label value can still contain
  multiple points per timestamp if other attributes differ).
- Series are sorted by label. Label format: `attribute=value`.
- Each series gets a palette color in sorted order. The dialog legend shows a swatch and
  the label; clicking toggles visibility.
- Hidden series stay in the y-domain (so the axis does not jump) and are excluded from
  hover.
- Hover snaps to the nearest distinct timestamp across visible series, draws one dot per
  series, and lists `label: value` for each visible series. A single visible series keeps
  the current single-value readout.

## Data / Interfaces

`client/utils/metrics.ts`:

```ts
export interface MetricSeries {
  key: string
  label: string
  samples: MetricSample[]
}

export interface MetricGroup {
  // existing fields…
  /** Chronological, type-aware aggregate across all series. */
  samples: MetricSample[]
  /** Distinct series in this group (service + attributes). */
  seriesCount: number
}

export function aggregateSamples(dataPoints: readonly Metric[]): MetricSample[]
export function sampleStats(samples: readonly MetricSample[]): { min: number; max: number; avg: number } | null
export function mergeHistograms(histograms: readonly HistogramData[]): HistogramData | null
export function breakdownKeys(dataPoints: readonly Metric[]): string[]
export function breakdownSeries(dataPoints: readonly Metric[], attribute: string | null): MetricSeries[]
export function metricSeriesCount(dataPoints: readonly Metric[]): number
```

- `metricStats` delegates to `sampleStats(aggregateSamples(...))` so existing callers stay correct.
- `groupMetrics` sets `samples`, `latestValue` (last sample), `sparklineValues` (sample
  values), `latestHistogram` (histograms at the newest timestamp, merged), and
  `seriesCount`.

`client/utils/chart.ts`:

```ts
export interface ChartSeries {
  key: string
  label: string
  points: ChartPoint[]
}

export interface ChartDomain {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function chartDomain(points: readonly ChartPoint[]): ChartDomain | null
export function mapChartPoint(point: ChartPoint, domain: ChartDomain, width: number, height: number): ChartPoint
```

`chartPoints` is refactored to use the two helpers; its behavior and tests stay unchanged.
`MetricLineChart.vue` accepts `series: ChartSeries[]`; shared axes are computed over the
union of all series.

`MetricHoverReadout.vue` gains an optional `entries: { label: string; value: string; color: string }[]`.
When present it renders one row per series; otherwise it keeps the existing single value.

## Edge Cases / Review Focus

1. Multiple series at the same timestamp must not be connected across series.
2. Missing attribute values must become a `(none)` series, not disappear.
3. Histograms with different explicit bounds must merge by bound value, not by index.
4. Null values / zero-count histograms must not produce `NaN`, `Infinity`, or empty paths.
5. Single-series, attribute-free metrics must render exactly as today, with no breakdown
   control.
6. Many series (13) must not produce an unusable legend or hover readout; the palette may
   cycle, labels disambiguate.
7. Cumulative counters are summed as-is; no rate conversion is introduced.
