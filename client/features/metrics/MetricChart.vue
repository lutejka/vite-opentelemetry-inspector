<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '~/ui/utils/format'
import { areaPath, chartPoints, niceValueTicks, polylinePath } from '~/utils/chart'
import type { ChartPoint } from '~/utils/chart'

const VIEW_WIDTH = 640
const PADDING = { left: 48, right: 8, top: 8, bottom: 24 }

const { points, unit, height = 260 } = defineProps<{
  points: ChartPoint[]
  unit?: string | null
  height?: number
}>()

const innerWidth = computed(() => VIEW_WIDTH - PADDING.left - PADDING.right)
const innerHeight = computed(() => Math.max(0, height - PADDING.top - PADDING.bottom))

/** chartPoints assumes finite inputs; drop malformed records before they poison every SVG path. */
const validPoints = computed(() => points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)))

/**
 * Nice ticks cover the data range by construction (`floor(min/step)`…`ceil(max/step)`),
 * so their bounds also become the plotted y-domain: every tick gets a gridline, and the
 * line/area are scaled to the same ticks instead of being crushed against a near-empty axis.
 */
const yAxis = computed(() => {
  if (validPoints.value.length === 0) return null

  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of validPoints.value) {
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  const ticks = niceValueTicks(minY, maxY)
  return {
    ticks,
    // Union rather than trusting tick bounds alone; identical for well-formed ticks.
    minY: ticks.length > 0 ? Math.min(minY, ticks[0]!) : minY,
    maxY: ticks.length > 0 ? Math.max(maxY, ticks.at(-1)!) : maxY,
  }
})

const plotted = computed(() => {
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
        x: PADDING.left + point.x,
        y: PADDING.top + point.y,
        time: formatTime(sourcePoint.x),
        value: sourcePoint.y,
      }
    })
})

const linePath = computed(() => polylinePath(plotted.value))
const areaFill = computed(() => areaPath(plotted.value, PADDING.top + innerHeight.value))

const yTicks = computed(() => {
  const axis = yAxis.value
  if (!axis || plotted.value.length === 0) return []

  const span = axis.maxY - axis.minY
  return axis.ticks.map(value => ({
    value,
    y: PADDING.top
      + (span === 0 ? innerHeight.value / 2 : innerHeight.value - ((value - axis.minY) / span) * innerHeight.value),
  }))
})

const xLabels = computed(() => {
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
  <svg :viewBox="`0 0 ${VIEW_WIDTH} ${height}`" class="w-full">
    <template v-if="plotted.length > 0">
      <g v-for="tick in yTicks" :key="tick.value">
        <line
          :x1="PADDING.left"
          :x2="VIEW_WIDTH - PADDING.right"
          :y1="tick.y"
          :y2="tick.y"
          stroke="currentColor"
          opacity="0.12"
        />
        <text
          :x="PADDING.left - 6"
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

      <template v-if="plotted.length <= 200">
        <circle
          v-for="(point, index) in plotted"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="2"
          fill="var(--color-primary)"
        >
          <title>{{ point.time }} — {{ formatNumber(point.value) }}{{ unit ? ' ' + unit : '' }}</title>
        </circle>
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
</template>
