<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '~/ui/utils/format'
import { niceValueTicks } from '~/utils/chart'
import { histogramBars } from '~/utils/metrics'
import type { HistogramBar } from '~/utils/metrics'
import type { HistogramData } from '~shared/types'

const VIEW_WIDTH = 640

const { histogram, unit, height = 260 } = defineProps<{
  histogram: HistogramData
  unit?: string | null
  height?: number
}>()

const bars = computed(() => histogramBars(histogram))

/** Wide histograms rotate their bucket labels instead of overlapping them. */
const rotated = computed(() => bars.value.length > 6)

const padding = computed(() => ({ left: 48, right: 8, top: 8, bottom: rotated.value ? 48 : 24 }))
const innerWidth = computed(() => VIEW_WIDTH - padding.value.left - padding.value.right)
const innerHeight = computed(() => Math.max(0, height - padding.value.top - padding.value.bottom))

const maxCount = computed(() => Math.max(1, ...bars.value.map(bar => bar.count)))

/** Integer-only gridlines: a bucket count is always a whole number of samples. */
const yTicks = computed(() => niceValueTicks(0, maxCount.value).filter(value => Number.isInteger(value)))
const plotMax = computed(() => yTicks.value.at(-1) ?? maxCount.value)

const slotWidth = computed(() => (bars.value.length > 0 ? innerWidth.value / bars.value.length : 0))
const barGap = computed(() => Math.min(6, slotWidth.value / 4))

const barsLayout = computed(() =>
  bars.value.map((bar, index) => {
    const width = Math.max(1, slotWidth.value - barGap.value)
    const x = padding.value.left + index * slotWidth.value + (slotWidth.value - width) / 2
    const barHeight = (bar.count / plotMax.value) * innerHeight.value
    const y = padding.value.top + innerHeight.value - barHeight
    return {
      ...bar,
      x,
      y,
      width,
      height: barHeight,
      label: barLabel(bar),
      center: x + width / 2,
      countY: Math.max(y - 4, padding.value.top + 8),
    }
  })
)

const ticks = computed(() =>
  yTicks.value.map(value => ({
    value,
    y: padding.value.top + innerHeight.value - (value / plotMax.value) * innerHeight.value,
  }))
)

/** Compact bounds keep the bucket labels shorter than the bars they sit under. */
function formatBound(value: number): string {
  return formatNumber(value, { notation: 'compact', maximumSignificantDigits: 2 })
}

function formatCount(value: number): string {
  return formatNumber(value, { notation: 'compact', maximumSignificantDigits: 2 })
}

function barLabel(bar: HistogramBar): string {
  if (bar.from === null) {
    return bar.to === null ? 'all' : `≤ ${formatBound(bar.to)}`
  }
  if (bar.to === null) {
    return `> ${formatBound(bar.from)}`
  }
  return `${formatBound(bar.from)}–${formatBound(bar.to)}`
}
</script>

<template>
  <svg :viewBox="`0 0 ${VIEW_WIDTH} ${height}`" class="w-full">
    <template v-if="barsLayout.length > 0">
      <g v-for="tick in ticks" :key="tick.value">
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
          {{ formatCount(tick.value) }}
        </text>
      </g>

      <g v-for="(bar, index) in barsLayout" :key="index">
        <title>{{ bar.label }}{{ unit ? ' ' + unit : '' }}: {{ formatNumber(bar.count) }}</title>
        <rect
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          rx="1"
          fill="var(--color-primary)"
          opacity="0.75"
        />
        <text
          :x="bar.center"
          :y="bar.countY"
          text-anchor="middle"
          class="text-micro"
          fill="currentColor"
          opacity="0.6"
        >
          {{ formatCount(bar.count) }}
        </text>
        <text
          v-if="!rotated"
          :x="bar.center"
          :y="height - 6"
          text-anchor="middle"
          class="text-micro"
          fill="currentColor"
          opacity="0.5"
        >
          {{ bar.label }}
        </text>
        <text
          v-else
          :x="bar.center"
          :y="height - 8"
          text-anchor="end"
          :transform="`rotate(-40 ${bar.center} ${height - 8})`"
          class="text-micro"
          fill="currentColor"
          opacity="0.5"
        >
          {{ bar.label }}
        </text>
      </g>
    </template>
  </svg>
</template>
