# Metric Series Aggregation & Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop same-timestamp OTLP series from being connected into a sawtooth: aggregate metric groups per timestamp for the tiles, and add an optional single-attribute breakdown to the chart dialog.

**Architecture:** Add type-aware per-timestamp aggregation and series helpers to `client/utils/metrics.ts`, shared chart domain mapping to `client/utils/chart.ts`, and multi-series rendering (shared axes, legend, multi-value hover) to `MetricLineChart.vue`. The tile always passes one aggregated series; the dialog passes either the aggregate or one series per value of the selected attribute.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript (strict), Vite, vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-metric-series-design.md`

## Global Constraints

- No new runtime dependencies.
- Keep the existing single-series appearance and behavior; multi-series is additive.
- All series colors come from existing CSS variables in `client/styles/theme.css`.
- No PromQL, query editor, or free-form filters.
- Aggregate raw values; do **not** convert counters to rates.
- Breakdown is by exactly one attribute key at a time.
- Gauge display is **option A**: multi-series gauges use a selected real series in the dialog; the tile shows `N series`; single-series gauges are unchanged.
- The chart animation layer (`useAnimatedPoints`) must keep working; all visible series animate as one keyed layout.
- Utilities are tested with vitest (`pnpm test`); SVG behavior is verified manually in `pnpm dev:client`.
- `pnpm exec vue-tsc --noEmit` has two pre-existing errors in `examples/vite-devtools/main.ts` (lines 496, 500). Do not use it as a gate.

## Review Focus

- Two or more series at the same timestamp must never be connected in one path. Tested in `aggregateSamples` / `groupMetrics` and verified in the dev client.
- Missing attribute values must form a `(none)` series, not vanish. Tested in `breakdownSeries`.
- Histograms with different explicit bounds must merge by bound value. Tested in `mergeHistograms`.
- Null values and zero-count histograms must never yield `NaN`, `Infinity`, or empty paths. Tested in `aggregateSamples` / `mergeHistograms`.
- Single-series attribute-free metrics must look unchanged and show no breakdown control. Covered by existing tests plus the final manual checklist.
- Many series (13) must keep the legend and hover usable. Manual checklist (palette cycles, labels disambiguate).
- Cumulative counters are summed, not rate-converted. Tested in `aggregateSamples`.
- A multi-series gauge must never present a synthetic aggregate as its current value: the dialog selector drives the gauge/scale/Latest, and the tile shows `N series`. Manual checklist.
- Animation must not scramble series: keys include the series key and each series still draws one continuous path. Tested in `animation.test.ts` plus the manual checklist.

---

### Task 0: Baseline (already applied)

**Files:** none.

**Interfaces:**
- Consumes: nothing.
- Produces: a clean baseline on `feat/metric-series-aggregation`.

- [ ] **Step 1: Confirm the baseline**

The rename `MetricChart.vue` → `MetricLineChart.vue` was already committed in `58154f8`
(`feat: Animate charts`), together with the chart animation layer. Do not redo it.

Run: `pnpm test`
Expected: all test files pass.

Run: `git status --short`
Expected: only the planning docs are untracked (they are committed by the executor before Task 1).

---

### Task 1: Shared chart-domain helpers

**Files:**
- Modify: `client/utils/chart.ts`
- Test: `client/utils/chart.test.ts`

**Interfaces:**
- Consumes: existing `ChartPoint`.
- Produces:
  - `interface ChartDomain { minX: number; maxX: number; minY: number; maxY: number }`
  - `interface ChartSeries { key: string; label: string; points: ChartPoint[] }`
  - `chartDomain(points: readonly ChartPoint[]): ChartDomain | null`
  - `mapChartPoint(point: ChartPoint, domain: ChartDomain, width: number, height: number): ChartPoint`
  - `chartPoints` keeps its signature and behavior, implemented with the two helpers.

- [ ] **Step 1: Write the failing tests**

Add to `client/utils/chart.test.ts`:

```ts
describe('chartDomain', () => {
  it('returns null for empty input and the exact bounds otherwise', () => {
    expect(chartDomain([])).toBeNull()
    expect(chartDomain([{ x: 1, y: 5 }, { x: 3, y: 9 }])).toEqual({ minX: 1, maxX: 3, minY: 5, maxY: 9 })
  })

  it('keeps degenerate domains degenerate', () => {
    expect(chartDomain([{ x: 4, y: 7 }])).toEqual({ minX: 4, maxX: 4, minY: 7, maxY: 7 })
  })
})

describe('mapChartPoint', () => {
  const domain = { minX: 0, maxX: 10, minY: 0, maxY: 100 }

  it('maps a custom domain into the pixel box with y inverted', () => {
    expect(mapChartPoint({ x: 0, y: 0 }, domain, 100, 50)).toEqual({ x: 0, y: 50 })
    expect(mapChartPoint({ x: 10, y: 100 }, domain, 100, 50)).toEqual({ x: 100, y: 0 })
  })

  it('centres degenerate axes and clamps outside the domain', () => {
    const flat = { minX: 5, maxX: 5, minY: 7, maxY: 7 }
    expect(mapChartPoint({ x: 5, y: 7 }, flat, 100, 50)).toEqual({ x: 50, y: 25 })
    expect(mapChartPoint({ x: -1, y: 200 }, domain, 100, 50)).toEqual({ x: 0, y: 0 })
  })
})
```

Import `chartDomain` and `mapChartPoint` in the test file's import list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run client/utils/chart.test.ts`
Expected: FAIL — `chartDomain` / `mapChartPoint` are not exported.

- [ ] **Step 3: Implement the helpers**

In `client/utils/chart.ts`:

- `chartDomain` scans finite `x`/`y` values and returns min/max, or `null` for empty input.
- `mapChartPoint` maps with the same formulas `chartPoints` uses today: degenerate `spanX` → `width / 2`, degenerate `spanY` → `height / 2`, otherwise inverted y and clamped to `[0, width]` / `[0, height]`.
- Rewrite `chartPoints` as `const domain = chartDomain(points); return domain ? points.map(p => mapChartPoint(p, domain, width, height)) : []`.
- Add the `ChartSeries` interface unchanged (it is used by `MetricLineChart` later).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run client/utils/chart.test.ts`
Expected: PASS, including the unchanged `chartPoints` tests.

- [ ] **Step 5: Commit**

```bash
git add client/utils/chart.ts client/utils/chart.test.ts
git commit -m "feat(chart): share chart domain mapping across series"
```

---

### Task 2: Aggregation, stats, and breakdown primitives

**Files:**
- Modify: `client/utils/metrics.ts`
- Test: `client/utils/metrics.test.ts`

**Interfaces:**
- Consumes: `Metric`, `MetricSample`, `HistogramData`, `metricPointValue`.
- Produces:
  - `interface MetricSeries { key: string; label: string; samples: MetricSample[] }`
  - `aggregateSamples(dataPoints: readonly Metric[]): MetricSample[]`
  - `sampleStats(samples: readonly MetricSample[]): { min: number; max: number; avg: number } | null`
  - `mergeHistograms(histograms: readonly HistogramData[]): HistogramData | null`
  - `breakdownKeys(dataPoints: readonly Metric[]): string[]`
  - `breakdownSeries(dataPoints: readonly Metric[], attribute: string | null): MetricSeries[]`
  - `metricSeriesCount(dataPoints: readonly Metric[]): number`
  - `interface MetricSeriesLatest { key: string; label: string; value: number; values: number[] }`
  - `latestSeries(dataPoints: readonly Metric[]): MetricSeriesLatest[]`

- [ ] **Step 1: Write the failing tests**

Add to `client/utils/metrics.test.ts` (the existing `m()` factory makes points):

```ts
describe('aggregateSamples', () => {
  it('sums counters that share a timestamp and sorts timestamps ascending', () => {
    expect(aggregateSamples([
      m({ timestamp: 20, type: 'counter', value: 4 }),
      m({ timestamp: 10, type: 'counter', value: 2 }),
      m({ timestamp: 10, type: 'counter', value: 3 }),
    ])).toEqual([
      { timestamp: 10, value: 5 },
      { timestamp: 20, value: 4 },
    ])
  })

  it('averages gauges that share a timestamp', () => {
    expect(aggregateSamples([
      m({ timestamp: 10, type: 'gauge', value: 10 }),
      m({ timestamp: 10, type: 'gauge', value: 20 }),
      m({ timestamp: 20, type: 'gauge', value: 30 }),
    ])).toEqual([
      { timestamp: 10, value: 15 },
      { timestamp: 20, value: 30 },
    ])
  })

  it('combines histograms with a count-weighted mean', () => {
    expect(aggregateSamples([
      m({ timestamp: 10, type: 'histogram', histogram: { buckets: [], sum: 100, count: 4, min: 1, max: 40 } }),
      m({ timestamp: 10, type: 'histogram', histogram: { buckets: [], sum: 300, count: 6, min: 2, max: 90 } }),
    ])).toEqual([{ timestamp: 10, value: 40 }])
  })

  it('ignores null values and zero-count histograms', () => {
    expect(aggregateSamples([
      m({ timestamp: 10, type: 'gauge', value: null }),
      m({ timestamp: 10, type: 'histogram', histogram: { buckets: [], sum: 0, count: 0, min: 0, max: 0 } }),
    ])).toEqual([])
    expect(aggregateSamples([
      m({ timestamp: 10, type: 'gauge', value: null }),
      m({ timestamp: 10, type: 'gauge', value: 8 }),
    ])).toEqual([{ timestamp: 10, value: 8 }])
  })
})

describe('sampleStats', () => {
  it('computes min/max/avg over sample values and null for none', () => {
    expect(sampleStats([{ timestamp: 1, value: 10 }, { timestamp: 2, value: 30 }]))
      .toEqual({ min: 10, max: 30, avg: 20 })
    expect(sampleStats([])).toBeNull()
  })
})

describe('mergeHistograms', () => {
  it('merges bucket counts by bound and sums sum/count/min/max', () => {
    expect(mergeHistograms([
      { buckets: [{ bound: 10, count: 2 }, { bound: 50, count: 1 }], sum: 30, count: 3, min: 1, max: 40 },
      { buckets: [{ bound: 10, count: 1 }, { bound: 100, count: 4 }], sum: 60, count: 5, min: 2, max: 90 },
    ])).toEqual({
      buckets: [{ bound: 10, count: 3 }, { bound: 50, count: 1 }, { bound: 100, count: 4 }],
      sum: 90,
      count: 8,
      min: 1,
      max: 90,
    })
  })

  it('returns null for empty input and handles no overlapping bounds', () => {
    expect(mergeHistograms([])).toBeNull()
    expect(mergeHistograms([
      { buckets: [], sum: 0, count: 0, min: 0, max: 0 },
    ])).toEqual({ buckets: [], sum: 0, count: 0, min: 0, max: 0 })
  })
})

describe('breakdownKeys', () => {
  it('lists sorted attribute keys with at least two distinct values', () => {
    expect(breakdownKeys([
      m({ attributes: { route: '/', method: 'GET' } }),
      m({ attributes: { route: '/x', method: 'GET' } }),
    ])).toEqual(['route'])
  })
})

describe('breakdownSeries', () => {
  const points = [
    m({ timestamp: 20, type: 'counter', value: 3, attributes: { method: 'GET' } }),
    m({ timestamp: 10, type: 'counter', value: 1, attributes: { method: 'GET' } }),
    m({ timestamp: 20, type: 'counter', value: 4, attributes: { method: 'POST' } }),
    m({ timestamp: 10, type: 'counter', value: 2, attributes: { method: 'POST' } }),
    m({ timestamp: 30, type: 'counter', value: 5 }),
  ]

  it('returns one aggregated series for null', () => {
    expect(breakdownSeries(points, null)).toEqual([
      { key: '', label: '', samples: [
        { timestamp: 10, value: 3 },
        { timestamp: 20, value: 7 },
        { timestamp: 30, value: 5 },
      ] },
    ])
  })

  it('splits by attribute value, sorts by label, and groups missing values as (none)', () => {
    expect(breakdownSeries(points, 'method')).toEqual([
      { key: '(none)', label: 'method=(none)', samples: [{ timestamp: 30, value: 5 }] },
      { key: 'GET', label: 'method=GET', samples: [{ timestamp: 10, value: 1 }, { timestamp: 20, value: 3 }] },
      { key: 'POST', label: 'method=POST', samples: [{ timestamp: 10, value: 2 }, { timestamp: 20, value: 4 }] },
    ])
  })
})

describe('metricSeriesCount', () => {
  it('counts distinct service + attribute combinations', () => {
    expect(metricSeriesCount([
      m({ service_name: 'a', attributes: { route: '/' } }),
      m({ service_name: 'a', attributes: { route: '/' } }),
      m({ service_name: 'a', attributes: { route: '/x' } }),
      m({ service_name: 'b', attributes: { route: '/' } }),
    ])).toBe(3)
  })
})

describe('latestSeries', () => {
  it('returns the latest value and history per series, sorted by label', () => {
    expect(latestSeries([
      m({ timestamp: 10, service_name: 'demo', value: 1, attributes: { space: 'old' } }),
      m({ timestamp: 20, service_name: 'demo', value: 3, attributes: { space: 'old' } }),
      m({ timestamp: 10, service_name: 'demo', value: 2, attributes: { space: 'new' } }),
      m({ timestamp: 20, service_name: 'demo', value: 4, attributes: { space: 'new' } }),
    ])).toEqual([
      { key: '["demo",[["space","new"]]]', label: 'space=new', value: 4, values: [2, 4] },
      { key: '["demo",[["space","old"]]]', label: 'space=old', value: 3, values: [1, 3] },
    ])
  })

  it('labels an attribute-free series with its service name', () => {
    expect(latestSeries([
      m({ timestamp: 10, service_name: 'demo', value: 7 }),
    ]).map(series => series.label)).toEqual(['demo'])
  })
})
```

Import the new functions in the test file's import list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run client/utils/metrics.test.ts`
Expected: FAIL — the new exports do not exist.

- [ ] **Step 3: Implement the primitives**

In `client/utils/metrics.ts`:

- `aggregateSamples`: copy and sort points ascending by `timestamp`; group by timestamp; for each group:
  - If every point has a histogram with `count > 0`, value = `Σsum / Σcount`.
  - Otherwise collect `metricPointValue` for the non-histogram points; if none, fall back to the histogram weighted mean. If the group type is `counter` (take the newest point's type), sum; otherwise mean.
  - Drop timestamps with no numeric value.
- `sampleStats`: min/max/avg over sample values; `null` for empty.
- `metricStats(dataPoints)`: `return sampleStats(aggregateSamples(dataPoints))` (existing tests must still pass).
- `mergeHistograms`: accumulate bucket counts in a `Map<number, number>` keyed by `bound`, sorted ascending; sum `sum`/`count`; `min` = min over histograms with `count > 0`, `max` = max over those; `null` for an empty list.
- `breakdownKeys`: for each attribute key, collect distinct `String(value)` values (missing → `'(none)'`); return sorted keys with `size >= 2`.
- `breakdownSeries(dataPoints, attribute)`:
  - `null` → one `MetricSeries` with `key: ''`, `label: ''`, `samples: aggregateSamples(dataPoints)`.
  - Otherwise group points by `p.attributes?.[attribute] == null ? '(none)' : String(p.attributes[attribute])`; build `key` = value, `label` = `${attribute}=${value}`, `samples: aggregateSamples(group)`; drop empty sample lists; sort by `label` with `localeCompare`.
- `metricSeriesCount`: distinct `JSON.stringify([service_name, sorted attributes])`.
- `latestSeries`: group by the same service + sorted-attributes key; aggregate each group with `aggregateSamples`; keep one entry per group with `key`, `label`, `value` (last sample), and `values` (all sample values). Label = `key=value` pairs joined with `, `, or the service name when there are no attributes; prefix `service_name · ` when the input spans multiple services. Drop groups with no samples; sort by `label`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run client/utils/metrics.test.ts`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add client/utils/metrics.ts client/utils/metrics.test.ts
git commit -m "feat(metrics): aggregate series and expose breakdown helpers"
```

---

### Task 3: Aggregate `MetricGroup` fields

**Files:**
- Modify: `client/utils/metrics.ts`
- Test: `client/utils/metrics.test.ts`

**Interfaces:**
- Consumes: `aggregateSamples`, `mergeHistograms`, `metricSeriesCount`.
- Produces: `MetricGroup` gains `samples: MetricSample[]` and `seriesCount: number`.

- [ ] **Step 1: Write the failing test**

Add to `client/utils/metrics.test.ts`:

```ts
it('aggregates same-timestamp series and merges the newest histograms', () => {
  const groups = groupMetrics([
    m({ metric_id: 'a1', timestamp: 100, service_name: 'demo', value: 1, attributes: { method: 'GET' } }),
    m({ metric_id: 'a2', timestamp: 100, service_name: 'demo', value: 2, attributes: { method: 'POST' } }),
    m({ metric_id: 'a3', timestamp: 200, service_name: 'demo', value: 3, attributes: { method: 'GET' } }),
    m({ metric_id: 'a4', timestamp: 200, service_name: 'demo', value: 4, attributes: { method: 'POST' } }),
  ])
  expect(groups[0]!.samples).toEqual([
    { timestamp: 100, value: 3 },
    { timestamp: 200, value: 7 },
  ])
  expect(groups[0]!.latestValue).toBe(7)
  expect(groups[0]!.sparklineValues).toEqual([3, 7])
  expect(groups[0]!.seriesCount).toBe(2)
})

it('merges histograms reported at the newest timestamp', () => {
  const groups = groupMetrics([
    m({ timestamp: 100, type: 'histogram', attributes: { route: '/a' }, histogram: { buckets: [{ bound: 10, count: 1 }], sum: 10, count: 1, min: 10, max: 10 } }),
    m({ timestamp: 100, type: 'histogram', attributes: { route: '/b' }, histogram: { buckets: [{ bound: 10, count: 2 }, { bound: 50, count: 1 }], sum: 70, count: 3, min: 5, max: 60 } }),
    m({ timestamp: 50, type: 'histogram', histogram: { buckets: [{ bound: 10, count: 9 }], sum: 90, count: 9, min: 1, max: 9 } }),
  ])
  expect(groups[0]!.latestHistogram).toEqual({
    buckets: [{ bound: 10, count: 3 }, { bound: 50, count: 1 }],
    sum: 80,
    count: 4,
    min: 5,
    max: 60,
  })
  expect(groups[0]!.latestValue).toBe(20)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run client/utils/metrics.test.ts`
Expected: FAIL — `samples`/`seriesCount` are missing and `latestValue` is 4.

- [ ] **Step 3: Implement the aggregation in `groupMetrics`**

In `groupMetrics`:

- `const samples = aggregateSamples(dataPoints)`.
- `const latestSample = samples.at(-1) ?? null`.
- `latestValue: latestSample?.value ?? null`.
- `sparklineValues: samples.map(sample => sample.value)`.
- `samples`.
- `seriesCount: metricSeriesCount(dataPoints)`.
- `latestHistogram`: from points whose `timestamp` equals the newest timestamp (`dataPoints[0]!.timestamp` after the existing descending sort) and whose `histogram` is non-null; `mergeHistograms(...)`, otherwise `null`.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add client/utils/metrics.ts client/utils/metrics.test.ts
git commit -m "feat(metrics): aggregate group samples and latest histogram"
```

---

### Task 4: Multi-series line chart and hover readout

**Files:**
- Modify: `client/features/metrics/MetricLineChart.vue`
- Modify: `client/features/metrics/MetricHoverReadout.vue`
- Modify: `client/features/metrics/MetricTile.vue`
- Modify: `client/features/metrics/MetricChartDialog.vue`

**Interfaces:**
- Consumes: `ChartSeries`, `ChartDomain`, `chartDomain`, `mapChartPoint`, `MetricGroup.samples`, `useAnimatedPoints`, `KeyedChartPoint`.
- Produces:
  - `KeyedChartPoint.key` widens from `number` to `string | number` in `client/utils/animation.ts`.
  - `MetricLineChart` props: `{ series: ChartSeries[]; unit?: string | null; height?: number; compact?: boolean }`.
  - `MetricHoverReadout` props add `entries?: { label: string; value: string; color: string }[] | null`.
- Both callers pass one aggregate series in this task; Task 5 adds more.

- [ ] **Step 1: Allow string keys in the animation layer**

The current chart animates one `KeyedChartPoint[]` with numeric keys. Multi-series needs
one key per `(series, timestamp)`, so widen the key type.

Add to `client/utils/animation.test.ts`:

```ts
it('supports string keys for multi-series layouts', () => {
  const from = [{ key: 'a:1', x: 0, y: 10 }, { key: 'b:1', x: 0, y: 20 }]
  const to = [{ key: 'a:1', x: 5, y: 0 }, { key: 'b:1', x: 5, y: 30 }]
  expect(tweenPoints(from, to, 0.5)).toEqual([
    { key: 'a:1', x: 2.5, y: 5 },
    { key: 'b:1', x: 2.5, y: 25 },
  ])
  expect(sameLayout(to, to)).toBe(true)
})
```

Run: `pnpm exec vitest run client/utils/animation.test.ts`
Expected: TypeScript/vitest failure because `key` is typed `number`.

Change `KeyedChartPoint.key` to `string | number`, then re-run:
Expected: PASS.

- [ ] **Step 2: Add the readout rows mode**

In `MetricHoverReadout.vue`:
- Make `value` optional (`value?: string | null`, default `null`) and add `entries?: { label: string; value: string; color: string }[] | null`, default `null`.
- When `entries` is non-empty, render one row per entry: a 6px color dot, the label (`color-faint`), and the formatted value (`tabular-nums`). Show the unit once next to the time line (`time · unit`). Format entry values with `formatNumber` before passing them in.
- When `entries` is empty/null, keep the current single value + unit markup.
- This stays backwards compatible: the chart keeps using `value` until Step 3.

- [ ] **Step 3: Implement multi-series rendering in `MetricLineChart.vue`**

Replace the `points` prop with `series: ChartSeries[]` and implement:

- **Valid series**: filter each series to finite points; drop empty series.
- **Y axis**: min/max across all valid points; in `compact` mode use the exact range; otherwise `niceValueTicks` expanded bounds as today.
- **Shared domain**: flatten all valid points, append `{ x: minX, y: axis.minY }` and `{ x: maxX, y: axis.maxY }`, then `chartDomain(...)`.
- **Animated layout**: keep the existing `targetPlotted` → `useAnimatedPoints` pattern, but flatten every visible series into one `KeyedChartPoint[]`:
  - `key: \`${series.key}:${point.x}\``
  - extra fields: `seriesKey`, `sourceX`, `sourceY`, formatted `time`
  - `x`/`y` from `mapChartPoint(point, domain, innerWidth, innerHeight)` plus padding
  - `plotted = useAnimatedPoints(targetPoints)`
  - split `plotted` by `seriesKey` for per-series paths/points (target order is preserved, so each series stays contiguous).
- **Paths**: one `polylinePath` per series from its split points; `areaPath` only when exactly one series is visible; no area in compact mode.
- **Colors**: `SERIES_COLORS = ['var(--color-primary)', 'var(--color-info)', 'var(--color-warning)', 'var(--color-success)', 'var(--color-red)', 'var(--color-yellow)', 'var(--color-pink)', 'var(--color-gray)']`, assigned by original series index modulo length.
- **Points**: render `circle` per point only when `!compact` and the total animated point count is ≤ 200; use the series color.
- **X labels**: build from the sorted unique `sourceX` values in the target layout, pick first/middle/last, map their x with `mapChartPoint`, and keep the existing `formatTime`/anchor logic.
- **Hover**:
  - `hoverX` holds the nearest source timestamp (not a pixel x).
  - Build `uniqueXs` from all visible series' `sourceX` values (sorted).
  - `onPointerMove` converts the pointer to viewBox x, uses `nearestPointIndex` over `uniqueXs` shaped as `{ x }`, and stores the nearest timestamp.
  - For each visible series, find the animated point with the nearest `sourceX`, then use its `x`/`y`.
  - Draw the vertical line at the mapped x, and one dot per series (`r="3"`, series color, `stroke="var(--ui-bg)"`, `stroke-width="2"`).
  - Readout: when one series is visible pass `value`/`unit` as today; otherwise pass `entries` (label, formatted value, color) and `unit`; anchor `top` to the highest dot.
- **Legend**: render only when `!compact && series.length > 1`, **outside** the pointer-tracking container. Restructure the root as an outer `<div>`: the existing `relative cursor-crosshair` container holds the SVG, markers, and readout, while the legend sits below it. Each button shows a color swatch and `series.label || 'aggregate'`; clicking toggles a `hiddenKeys: string[]` ref. Hidden series remain in the y-domain but are skipped in the animated layout, paths, dots, and hover; their legend item gets reduced opacity.
- **Hidden reset**: clear `hiddenKeys` when the series keys change.
- **No visible series**: render the axes only; skip paths, dots, hover, and the readout.

- [ ] **Step 4: Update the callers to the new prop (single aggregate series)**

`MetricTile.vue`:
- Replace `sparklinePoints` with `group.samples.map(sample => ({ x: sample.timestamp, y: sample.value }))` and remove the now-unused `metricSamples` import.
- Pass `:series="[{ key: 'aggregate', label: '', points: sparklinePoints }]"`.
- In the footer, render `{{ group.seriesCount > 1 ? group.seriesCount + ' series · ' : '' }}{{ group.dataPoints.length }} points`.
- Gauge option A: when `group.type === 'gauge' && group.seriesCount > 1`, render `{{ group.seriesCount }} series` in place of the big `NumberDisplay` value and do **not** render the tile's `MetricGauge`. Single-series gauges keep the current value + gauge.

`MetricChartDialog.vue`:
- Replace the raw `chartPoints` computed with one built from `group.samples.map(sample => ({ x: sample.timestamp, y: sample.value }))`.
- Remove the now-unused `metricPointValue` import (and the `ChartPoint` type import if it is no longer referenced).
- Pass `:series="[{ key: 'aggregate', label: '', points: chartPoints }]"`.
- Keep `latestHistogram` and `gaugeScale` as they are (they now use aggregated group data from Task 3).

- [ ] **Step 5: Run the full test suite, build, and check single-series charts**

Run: `pnpm test`
Expected: all pass.

Run: `pnpm build:client`
Expected: build succeeds.

Run: `pnpm dev:client` and open the printed URL (`/__opentelemetry/`), then check a metric tile and its dialog.
Expected: the fixtures' single-series charts look exactly as before (line, area, axis labels, hover).

- [ ] **Step 6: Commit**

```bash
git add client/features/metrics/MetricLineChart.vue client/features/metrics/MetricHoverReadout.vue client/features/metrics/MetricTile.vue client/features/metrics/MetricChartDialog.vue client/utils/animation.ts client/utils/animation.test.ts
git commit -m "feat(metrics): render multiple metric series in one chart"
```

---

### Task 5: Breakdown control in the chart dialog

**Files:**
- Modify: `client/features/metrics/MetricChartDialog.vue`

**Interfaces:**
- Consumes: `breakdownKeys`, `breakdownSeries`, `sampleStats`, `latestSeries`, `ChartSeries`, `MetricGroup.samples`.
- Produces: local `breakdownKey`, `gaugeSeriesKey`, `chartSeries`, `selectedGauge`; no new exports.

- [ ] **Step 1: Add the breakdown state and series computation**

In `MetricChartDialog.vue`:

- Import `breakdownKeys`, `breakdownSeries`, `latestSeries`, `sampleStats` and the `ChartSeries` type.
- Remove the now-unused `metricPointValue`/`metricStats`/`ChartPoint` imports.
- `const breakdownKey = ref('')`.
- `const gaugeSeriesKey = ref('')`.
- `const gaugeSeriesOptions = computed(() => (group?.type === 'gauge' ? latestSeries(group.dataPoints) : []))`.
- `const selectedGauge = computed(() => gaugeSeriesOptions.value.find(series => series.key === gaugeSeriesKey.value) ?? gaugeSeriesOptions.value[0] ?? null)`.
- `const labelKeys = computed(() => (group ? breakdownKeys(group.dataPoints) : []))`.
- `watch(() => group?.name, () => { breakdownKey.value = ''; gaugeSeriesKey.value = gaugeSeriesOptions.value[0]?.key ?? '' })` and reset each key when it is no longer in its option list.
- `const chartSeries = computed<ChartSeries[]>(() => { if (!group) return []; return breakdownSeries(group.dataPoints, breakdownKey.value || null).map(series => ({ key: series.key, label: series.label, points: series.samples.map(sample => ({ x: sample.timestamp, y: sample.value })) })) })`.
- `stats` becomes `sampleStats(group.samples)` instead of `metricStats(group.dataPoints)`.
- `statItems`: the `Latest` value is `group.type === 'gauge' ? selectedGauge.value?.value ?? group.latestValue : group.latestValue`.

- [ ] **Step 2: Add the select and use `chartSeries`**

- The `:series` bindings added in Task 4 now point at `chartSeries` instead of the aggregate-only list (gauge history and the default line).
- Above the line chart, render a row with the `History` label and, when `labelKeys.length > 0`, a select:
  - First option: `value=""`, label `None (aggregate)`.
  - Then `v-for="key in labelKeys"`, `:value="key"`, text `key`.
- For histogram groups, render both the (merged) bucket distribution and the history line:
  - Keep `<p>Bucket distribution of the latest data point</p>` → change copy to `Bucket distribution (all series)`.
  - Keep `MetricHistogramChart` with `group.latestHistogram`.
  - Add the same `History` + select + `MetricLineChart` below the distribution.
- Gauge section (option A):
  - When `gaugeSeriesOptions.length > 1`, render a `Series` select above the gauge, bound to `gaugeSeriesKey`, listing each option's `label`.
  - `MetricGauge` uses `:value="selectedGauge?.value ?? group.latestValue"` and `:scale="resolveGaugeScale(selectedGauge?.values ?? group.sparklineValues)"`.
  - A single-series gauge keeps the current markup with no selector and the same value/scale.
- The stat grid keeps its layout; only the `Latest` value follows the selected gauge series.

- [ ] **Step 3: Verify tests and build**

Run: `pnpm test`
Expected: all pass.

Run: `pnpm build:client`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/features/metrics/MetricChartDialog.vue
git commit -m "feat(metrics): add attribute breakdown to the chart dialog"
```

---

### Task 6: Multi-series fixture and manual verification

**Files:**
- Modify: `client/app/fixtures.ts`

**Interfaces:**
- Consumes: the existing `createMetrics` loop.
- Produces: a `http.server.request.count` counter with two series per timestamp for manual verification.

- [ ] **Step 1: Add the fixture series**

Inside the `for (let i = 0; i < 16; i++)` loop in `createMetrics`, push two counter points per iteration:

```ts
{
  metric_id: `fixture-http-count-get-${i}`,
  name: 'http.server.request.count',
  description: 'HTTP requests by method',
  unit: '1',
  type: 'counter',
  service_name: 'vite-devtools-demo',
  timestamp,
  value: 5 + i,
  histogram: null,
  attributes: { 'http.request.method': 'GET' },
},
{
  metric_id: `fixture-http-count-post-${i}`,
  name: 'http.server.request.count',
  description: 'HTTP requests by method',
  unit: '1',
  type: 'counter',
  service_name: 'vite-devtools-demo',
  timestamp,
  value: 1 + (i % 3),
  histogram: null,
  attributes: { 'http.request.method': 'POST' },
},
{
  metric_id: `fixture-heap-space-old-${i}`,
  name: 'process.memory.heap.space',
  description: 'Heap space size',
  unit: 'By',
  type: 'gauge',
  service_name: 'vite-devtools-demo',
  timestamp,
  value: 30_000_000 + i * 100_000,
  histogram: null,
  attributes: { 'v8js.heap.space.name': 'old_space' },
},
{
  metric_id: `fixture-heap-space-new-${i}`,
  name: 'process.memory.heap.space',
  description: 'Heap space size',
  unit: 'By',
  type: 'gauge',
  service_name: 'vite-devtools-demo',
  timestamp,
  value: 2_000_000 + (i % 4) * 500_000,
  histogram: null,
  attributes: { 'v8js.heap.space.name': 'new_space' },
},
```

Update the fixture comment "3 series × 16 points" to mention six metric families.

- [ ] **Step 2: Run the dev client and verify**

Run: `pnpm dev:client`
Open the printed URL (`/__opentelemetry/`), switch to **Metrics**.

Expected:

- `http.server.request.count` shows one smooth aggregate line (GET + POST summed per timestamp), not a sawtooth, with a `2 series` hint.
- Opening it shows the aggregate line by default; the Breakdown select lists `http.request.method`; selecting it draws two lines with a `http.request.method=GET` / `=POST` legend.
- Hovering shows both series values at the same timestamp; clicking a legend item hides it without changing the y-axis.
- `process.memory.heap.space` (gauge, 2 series) shows `2 series` on the tile instead of a single value and no gauge widget. Its dialog shows a `Series` select; switching between `old_space` and `new_space` changes the gauge value, the gauge scale, and the `Latest` stat — no averaged value.
- Single-series metrics (`process.memory.heap`, `http.requests.total`) show no breakdown or series select and look unchanged.
- The histogram dialog (`http.server.duration`) shows the merged bucket distribution plus the history line.
- If a metric has many series (e.g. 13 heap spaces when using live data), confirm the legend wraps rather than overflowing and the palette cycles; the hover readout stays legible.

- [ ] **Step 3: Commit**

```bash
git add client/app/fixtures.ts
git commit -m "test(metrics): add a multi-series counter fixture"
```

---

### Task 7: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all test files pass.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Build the client**

Run: `pnpm build:client`
Expected: build succeeds.

- [ ] **Step 4: Review the diff**

Run: `git status --short` and `git diff --stat`
Expected: only the intended files changed, with no generated output.

- [ ] **Step 5: Final manual pass**

Run `pnpm dev:client` once more and repeat the Task 6 checklist, including toggling the breakdown back to `None`.
