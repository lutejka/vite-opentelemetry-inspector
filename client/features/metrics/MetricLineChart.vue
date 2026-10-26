<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAnimatedPoints } from '~/composables/useAnimatedPoints'
import { formatNumber } from '~/ui/utils/format'
import { areaPath, chartPoints, nearestPointIndex, niceValueTicks, polylinePath } from '~/utils/chart'
import type { ChartPoint } from '~/utils/chart'
import MetricHoverReadout from './MetricHoverReadout.vue'

const VIEW_WIDTH = 640

const { points, unit, height = 260, compact = false } = defineProps<{
  points: ChartPoint[]
  unit?: string | null
  height?: number
  /** Sparkline mode: no axes, labels, points or area; stretches to fill the container. */
  compact?: boolean
}>()

const padding = computed(() =>
  compact ? { left: 2, right: 2, top: 2, bottom: 2 } : { left: 48, right: 8, top: 8, bottom: 24 }
)
const innerWidth = computed(() => VIEW_WIDTH - padding.value.left - padding.value.right)
const innerHeight = computed(() => Math.max(0, height - padding.value.top - padding.value.bottom))

/** chartPoints assumes finite inputs; drop malformed records before they poison every SVG path. */
const validPoints = computed(() => points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)))

/**
 * Nice ticks cover the data range by construction (`floor(min/step)`…`ceil(max/step)`),
 * so their bounds also become the plotted y-domain: every tick gets a gridline, and the
 * line/area are scaled to the same ticks instead of being crushed against a near-empty axis.
 * A compact sparkline instead uses the exact data range, like `sparklinePath`.
 */
const yAxis = computed(() => {
  if (validPoints.value.length === 0) return null

  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of validPoints.value) {
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  if (compact) return { ticks: [], minY, maxY }

  const ticks = niceValueTicks(minY, maxY)
  return {
    ticks,
    // Union rather than trusting tick bounds alone; identical for well-formed ticks.
    minY: ticks.length > 0 ? Math.min(minY, ticks[0]!) : minY,
    maxY: ticks.length > 0 ? Math.max(maxY, ticks.at(-1)!) : maxY,
  }
})

const targetPlotted = computed(() => {
  const source = validPoints.value
  const axis = yAxis.value
  if (source.length === 0 || !axis) return []

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  for (const point of source) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
  }

  // chartPoints derives its domain from the input, so append the expanded y bounds at the
  // data's x extremes, then drop the two synthetic points from the result.
  const extentPoints: ChartPoint[] = [
    ...source,
    { x: minX, y: axis.minY },
    { x: maxX, y: axis.maxY },
  ]
  return chartPoints(extentPoints, innerWidth.value, innerHeight.value)
    .slice(0, source.length)
    .map((point, index) => {
      const sourcePoint = source[index]!
      return {
        // Timestamps identify a sample across re-layouts; pixel x alone does not.
        key: sourcePoint.x,
        x: padding.value.left + point.x,
        y: padding.value.top + point.y,
        time: formatTime(sourcePoint.x),
        value: sourcePoint.y,
      }
    })
})

/** Eased towards `targetPlotted` so new samples slide in instead of snapping. */
const plotted = useAnimatedPoints(targetPlotted)

const linePath = computed(() => polylinePath(plotted.value))
const areaFill = computed(() => (compact ? '' : areaPath(plotted.value, padding.value.top + innerHeight.value)))

const yTicks = computed(() => {
  const axis = yAxis.value
  if (!axis || plotted.value.length === 0) return []

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

  const pointsInBox = plotted.value
  if (pointsInBox.length === 0) return []

  const lastIndex = pointsInBox.length - 1
  const indices = [...new Set([0, Math.floor(lastIndex / 2), lastIndex])]
  return indices.map((index) => {
    const point = pointsInBox[index]!
    return {
      key: index,
      x: point.x,
      y: height - 6,
      time: point.time,
      anchor: pointsInBox.length === 1 ? 'middle' : index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle',
    }
  })
})

const showPoints = computed(() => !compact && plotted.value.length > 0 && plotted.value.length <= 200)

const hoverIndex = ref<number | null>(null)
const hovered = computed(() => {
  const index = hoverIndex.value
  return index === null ? null : plotted.value[index] ?? null
})
const hoverFraction = computed(() => (hovered.value ? hovered.value.x / VIEW_WIDTH : 0))
const hoverTop = computed(() => (hovered.value ? `${(hovered.value.y / height) * 100}%` : null))
const hoverMarkerStyle = computed(() => ({
  left: `${hoverFraction.value * 100}%`,
  top: hoverTop.value ?? '0%',
  boxShadow: '0 0 0 2px var(--ui-bg)',
}))

function onPointerMove(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (rect.width <= 0 || plotted.value.length === 0) return
  const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
  hoverIndex.value = nearestPointIndex(plotted.value, x)
}

function clearHover() {
  hoverIndex.value = null
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
  <div class="relative cursor-crosshair" @pointermove="onPointerMove" @pointerleave="clearHover">
    <svg
      :viewBox="`0 0 ${VIEW_WIDTH} ${height}`"
      class="block w-full"
      :style="compact ? { height: `${height}px` } : undefined"
      :preserveAspectRatio="compact ? 'none' : undefined"
    >
      <template v-if="plotted.length > 0">
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
          v-if="hovered"
          :x1="hovered.x"
          :x2="hovered.x"
          :y1="padding.top"
          :y2="padding.top + innerHeight"
          stroke="currentColor"
          opacity="0.2"
          vector-effect="non-scaling-stroke"
        />

        <path v-if="areaFill" :d="areaFill" fill="var(--color-primary)" opacity="0.1" />
        <path
          v-if="linePath"
          :d="linePath"
          fill="none"
          stroke="var(--color-primary)"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <template v-if="showPoints">
          <circle
            v-for="(point, index) in plotted"
            :key="index"
            :cx="point.x"
            :cy="point.y"
            r="2"
            fill="var(--color-primary)"
          />
        </template>

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

    <span
      v-if="hovered"
      class="pointer-events-none absolute z-nav h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
      :style="hoverMarkerStyle"
    />
    <MetricHoverReadout
      v-if="hovered"
      :fraction="hoverFraction"
      :top="hoverTop"
      :time="hovered.time"
      :value="formatNumber(hovered.value)"
      :unit="unit"
    />
  </div>
</template>
