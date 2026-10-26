<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { KeyedChartPoint } from '~/utils/animation'
import { useAnimatedPoints } from '~/composables/useAnimatedPoints'
import { formatNumber } from '~/ui/utils/format'
import { areaPath, chartDomain, mapChartPoint, nearestPointIndex, niceValueTicks, pointAtX, polylinePath } from '~/utils/chart'
import type { ChartDomain, ChartPoint, ChartSeries } from '~/utils/chart'
import MetricHoverReadout from './MetricHoverReadout.vue'

const VIEW_WIDTH = 640

const SERIES_COLORS = [
  'var(--color-primary)',
  'var(--color-info)',
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-red)',
  'var(--color-yellow)',
  'var(--color-pink)',
  'var(--color-gray)',
]

const { series, unit, height = 260, compact = false } = defineProps<{
  series: ChartSeries[]
  unit?: string | null
  height?: number
  /** Sparkline mode: no axes, labels, points, area or legend; stretches to fill the container. */
  compact?: boolean
}>()

interface PlottedSeries {
  key: string
  label: string
  color: string
  points: ChartPoint[]
}

interface PlottedPoint extends KeyedChartPoint {
  seriesKey: string
  sourceX: number
  sourceY: number
  time: string
}

interface HoverEntry {
  key: string
  label: string
  color: string
  x: number
  y: number
  value: number
  time: string
}

const padding = computed(() =>
  compact ? { left: 2, right: 2, top: 2, bottom: 2 } : { left: 48, right: 8, top: 8, bottom: 24 }
)
const innerWidth = computed(() => VIEW_WIDTH - padding.value.left - padding.value.right)
const innerHeight = computed(() => Math.max(0, height - padding.value.top - padding.value.bottom))

/** Drop malformed points before they poison every SVG path; keep original colors stable. */
const validSeries = computed<PlottedSeries[]>(() =>
  series
    .map((entry, index) => ({
      key: entry.key,
      label: entry.label,
      color: SERIES_COLORS[index % SERIES_COLORS.length]!,
      points: entry.points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
    }))
    .filter(entry => entry.points.length > 0)
)

const hiddenKeys = ref<string[]>([])
const seriesKeys = computed(() => series.map(entry => entry.key).join('|'))
watch(seriesKeys, () => {
  hiddenKeys.value = []
})

function toggleSeries(key: string) {
  hiddenKeys.value = hiddenKeys.value.includes(key)
    ? hiddenKeys.value.filter(hidden => hidden !== key)
    : [...hiddenKeys.value, key]
}

const visibleSeries = computed(() =>
  validSeries.value.filter(entry => !hiddenKeys.value.includes(entry.key))
)

/**
 * Nice ticks cover the data range by construction (`floor(min/step)`…`ceil(max/step)`),
 * so their bounds also become the plotted y-domain: every tick gets a gridline, and the
 * lines/area are scaled to the same ticks instead of being crushed against a near-empty axis.
 * A compact sparkline instead uses the exact data range, like `sparklinePath`.
 * Hidden series stay in the domain so toggling a legend entry never rescales the axis.
 */
const yAxis = computed(() => {
  if (validSeries.value.length === 0) return null

  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const entry of validSeries.value) {
    for (const point of entry.points) {
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (compact) return { ticks: [], minY, maxY }

  const ticks = niceValueTicks(minY, maxY)
  return {
    ticks,
    minY: ticks.length > 0 ? Math.min(minY, ticks[0]!) : minY,
    maxY: ticks.length > 0 ? Math.max(maxY, ticks.at(-1)!) : maxY,
  }
})

/** One shared domain for every series, expanded to the nice tick bounds. */
const domain = computed<ChartDomain | null>(() => {
  const axis = yAxis.value
  if (!axis) return null

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  for (const entry of validSeries.value) {
    for (const point of entry.points) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
    }
  }

  return chartDomain([
    ...validSeries.value.flatMap(entry => entry.points),
    { x: minX, y: axis.minY },
    { x: maxX, y: axis.maxY },
  ])
})

/**
 * Flat keyed layout so every visible series animates together. The key pairs the
 * series identity with the source timestamp, which survives re-layouts.
 */
const targetPoints = computed<PlottedPoint[]>(() => {
  const plot = domain.value
  if (!plot) return []

  const points: PlottedPoint[] = []
  for (const entry of visibleSeries.value) {
    for (const point of entry.points) {
      const mapped = mapChartPoint(point, plot, innerWidth.value, innerHeight.value)
      points.push({
        key: `${entry.key}:${point.x}`,
        seriesKey: entry.key,
        x: padding.value.left + mapped.x,
        y: padding.value.top + mapped.y,
        sourceX: point.x,
        sourceY: point.y,
        time: formatTime(point.x),
      })
    }
  }
  return points
})

/** Eased towards `targetPoints` so new samples slide in instead of snapping. */
const plotted = useAnimatedPoints(targetPoints)

const plottedSeries = computed(() =>
  visibleSeries.value.map(entry => ({
    ...entry,
    points: plotted.value.filter(point => point.seriesKey === entry.key),
  }))
)

const linePaths = computed(() =>
  plottedSeries.value.map(entry => ({
    key: entry.key,
    color: entry.color,
    path: polylinePath(entry.points),
  }))
)

const areaFill = computed(() => {
  if (compact || plottedSeries.value.length !== 1) return ''
  return areaPath(plottedSeries.value[0]!.points, padding.value.top + innerHeight.value)
})
const areaColor = computed(() => plottedSeries.value[0]?.color ?? 'var(--color-primary)')

const yTicks = computed(() => {
  const axis = yAxis.value
  if (!axis || validSeries.value.length === 0) return []

  const span = axis.maxY - axis.minY
  return axis.ticks.map(value => ({
    value,
    y: padding.value.top
      + (span === 0
        ? innerHeight.value / 2
        : innerHeight.value - ((value - axis.minY) / span) * innerHeight.value),
  }))
})

const xLabels = computed(() => {
  if (compact) return []

  const plot = domain.value
  if (!plot || visibleSeries.value.length === 0) return []

  const uniqueXs = [...new Set(visibleSeries.value.flatMap(entry => entry.points.map(point => point.x)))]
    .sort((a, b) => a - b)
  const lastIndex = uniqueXs.length - 1
  const indices = [...new Set([0, Math.floor(lastIndex / 2), lastIndex])]

  return indices.map((index) => {
    const x = uniqueXs[index]!
    const mapped = mapChartPoint({ x, y: plot.minY }, plot, innerWidth.value, innerHeight.value)
    return {
      key: index,
      x: padding.value.left + mapped.x,
      y: height - 6,
      time: formatTime(x),
      anchor: uniqueXs.length === 1 ? 'middle' : index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle',
    }
  })
})

const showPoints = computed(() => !compact && plotted.value.length > 0 && plotted.value.length <= 200)

const hoverSourceX = ref<number | null>(null)

const hoverLineX = computed(() => {
  const plot = domain.value
  const targetX = hoverSourceX.value
  if (!plot || targetX === null) return null
  const mapped = mapChartPoint({ x: targetX, y: plot.minY }, plot, innerWidth.value, innerHeight.value)
  return padding.value.left + mapped.x
})

const hoverEntries = computed<HoverEntry[]>(() => {
  const targetX = hoverSourceX.value
  if (targetX === null) return []

  const entries: HoverEntry[] = []
  for (const entry of plottedSeries.value) {
    // Only report series that actually sampled this timestamp; a sparse series'
    // nearest point can be an older/newer sample and would be misleading.
    const source = entry.points.map(point => ({ x: point.sourceX, point }))
    const point = pointAtX(source, targetX)?.point
    if (!point) continue
    entries.push({
      key: entry.key,
      label: entry.label,
      color: entry.color,
      x: point.x,
      y: point.y,
      value: point.sourceY,
      time: point.time,
    })
  }
  return entries
})

const hoverFraction = computed(() => (hoverLineX.value === null ? 0 : hoverLineX.value / VIEW_WIDTH))
const hoverTopY = computed(() => {
  if (hoverEntries.value.length === 0) return null
  return Math.min(...hoverEntries.value.map(entry => entry.y))
})
const hoverTop = computed(() => (hoverTopY.value === null ? null : `${(hoverTopY.value / height) * 100}%`))
const hoverBelow = computed(
  () => !compact && hoverTopY.value !== null && hoverTopY.value < height * 0.45,
)
const hoverTime = computed(() => (hoverSourceX.value === null ? null : formatTime(hoverSourceX.value)))
const hoverEntriesFormatted = computed(() =>
  hoverEntries.value.map(entry => ({
    label: entry.label,
    value: formatNumber(entry.value),
    color: entry.color,
  }))
)

function onPointerMove(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (rect.width <= 0 || plotted.value.length === 0) return

  const pointerX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
  let nearest = plotted.value[0]!
  let bestDistance = Math.abs(nearest.x - pointerX)
  for (const point of plotted.value) {
    const distance = Math.abs(point.x - pointerX)
    if (distance < bestDistance) {
      bestDistance = distance
      nearest = point
    }
  }
  hoverSourceX.value = nearest.sourceX
}

function clearHover() {
  hoverSourceX.value = null
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * The 48-unit y-axis gutter fits compact labels; full grouping (e.g. "40,000,000") would clip.
 * Significant digits keep sub-1 values readable ("0.012") while large values stay compact ("40M").
 */
function formatAxisTick(value: number): string {
  return formatNumber(value, { notation: 'compact', maximumSignificantDigits: 2 })
}
</script>

<template>
  <div>
    <div class="relative cursor-crosshair" @pointermove="onPointerMove" @pointerleave="clearHover">
      <svg
        :viewBox="`0 0 ${VIEW_WIDTH} ${height}`"
        class="block w-full"
        :style="compact ? { height: `${height}px` } : undefined"
        :preserveAspectRatio="compact ? 'none' : undefined"
      >
        <template v-if="validSeries.length > 0">
          <g v-for="tick in yTicks" :key="tick.value">
            <line
              :x1="padding.left"
              :x2="VIEW_WIDTH - padding.right"
              :y1="tick.y"
              :y2="tick.y"
              stroke="currentColor"
              opacity="0.12"
            />
            <text
              :x="padding.left - 6"
              :y="tick.y"
              text-anchor="end"
              dominant-baseline="middle"
              class="text-micro"
              fill="currentColor"
              opacity="0.5"
            >
              {{ formatAxisTick(tick.value) }}
            </text>
          </g>

          <line
            v-if="hoverLineX !== null"
            :x1="hoverLineX"
            :x2="hoverLineX"
            :y1="padding.top"
            :y2="padding.top + innerHeight"
            stroke="currentColor"
            opacity="0.2"
            vector-effect="non-scaling-stroke"
          />

          <path v-if="areaFill" :d="areaFill" :fill="areaColor" opacity="0.1" />
          <path
            v-for="line in linePaths"
            :key="line.key"
            :d="line.path"
            fill="none"
            :stroke="line.color"
            stroke-width="1.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <template v-if="showPoints">
            <template v-for="entry in plottedSeries" :key="entry.key">
              <circle
                v-for="(point, index) in entry.points"
                :key="index"
                :cx="point.x"
                :cy="point.y"
                r="2"
                :fill="entry.color"
              />
            </template>
          </template>

          <circle
            v-for="entry in hoverEntries"
            :key="entry.key"
            :cx="entry.x"
            :cy="entry.y"
            r="3"
            :fill="entry.color"
            stroke="var(--ui-bg)"
            stroke-width="2"
          />

          <text
            v-for="label in xLabels"
            :key="label.key"
            :x="label.x"
            :y="label.y"
            :text-anchor="label.anchor"
            class="text-micro"
            fill="currentColor"
            opacity="0.5"
          >
            {{ label.time }}
          </text>
        </template>
      </svg>

      <MetricHoverReadout
        v-if="hoverEntries.length > 0"
        :fraction="hoverFraction"
        :top="hoverTop"
        :time="hoverTime"
        :entries="hoverEntries.length > 1 ? hoverEntriesFormatted : null"
        :value="hoverEntries.length === 1 ? formatNumber(hoverEntries[0]!.value) : null"
        :unit="unit"
        :below="hoverBelow"
      />
    </div>

    <div v-if="!compact && series.length > 1" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        v-for="entry in validSeries"
        :key="entry.key"
        type="button"
        class="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs color-faint transition hover:bg-raised"
        :class="{ 'opacity-40': hiddenKeys.includes(entry.key) }"
        :aria-pressed="!hiddenKeys.includes(entry.key)"
        @click="toggleSeries(entry.key)"
      >
        <span class="h-2 w-2 rounded-full" :style="{ background: entry.color }" />
        {{ entry.label || 'aggregate' }}
      </button>
    </div>
  </div>
</template>
