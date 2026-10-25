<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatNumber } from '~/ui/utils/format'
import { gaugeFraction, gaugeValueAtFraction } from '~/utils/gauge'
import type { GaugeScale } from '~/utils/gauge'
import MetricHoverReadout from './MetricHoverReadout.vue'

const { value, scale, unit = null, showValue = true, compact = false } = defineProps<{
  value: number | null
  scale: GaugeScale
  unit?: string | null
  showValue?: boolean
  compact?: boolean
}>()

const fractionPercent = computed(() => gaugeFraction(value, scale) * 100)
const valueText = computed(() => value === null ? '–' : formatNumber(value, { maximumFractionDigits: 2 }))

const ariaLabel = computed(() =>
  `${valueText.value}${unit ? ` ${unit}` : ''} on a scale from ${formatBound(scale.min)} to ${formatBound(scale.max)}`
)

const hoverFraction = ref<number | null>(null)
const hoverPercent = computed(() => (hoverFraction.value ?? 0) * 100)

const hoveredValue = computed(() =>
  hoverFraction.value === null ? null : gaugeValueAtFraction(scale, hoverFraction.value)
)
const hoveredValueText = computed(() =>
  hoveredValue.value === null ? '' : formatNumber(hoveredValue.value, { maximumFractionDigits: 2 })
)

function onGaugePointerMove(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (rect.width <= 0) return
  hoverFraction.value = clamp01((event.clientX - rect.left) / rect.width)
}

function clearGaugeHover() {
  hoverFraction.value = null
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

function formatBound(bound: number): string {
  return formatNumber(bound, { notation: 'compact', maximumSignificantDigits: 3 })
}
</script>

<template>
  <div
    class="flex flex-col"
    :class="compact ? 'gap-1' : 'gap-1.5'"
    role="img"
    :aria-label="ariaLabel"
  >
    <div v-if="showValue" class="flex items-baseline justify-center gap-1 min-w-0">
      <span class="text-2xl font-semibold font-mono tabular-nums truncate">{{ valueText }}</span>
      <span v-if="unit" class="text-xs color-faint truncate">{{ unit }}</span>
    </div>

    <div
      class="relative flex cursor-crosshair items-center"
      :class="compact ? 'h-4' : 'h-7'"
      @pointermove="onGaugePointerMove"
      @pointerleave="clearGaugeHover"
    >
      <div
        class="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-current opacity-20"
        :class="compact ? 'h-1.5' : 'h-2.5'"
      />
      <div
        v-if="value !== null"
        class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary shadow-sm"
        :class="compact ? 'h-3.5 w-0.5' : 'h-6 w-1'"
        :style="{ left: `${fractionPercent}%` }"
      />
      <div
        v-if="hoverFraction !== null"
        class="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-current opacity-40"
        :style="{ left: `${hoverPercent}%` }"
      />
      <MetricHoverReadout
        v-if="hoverFraction !== null"
        :fraction="hoverFraction"
        :value="hoveredValueText"
        :unit="unit"
      />
    </div>

    <div class="flex justify-between gap-2" :class="compact ? 'text-micro' : 'text-xs'">
      <span class="color-faint truncate">{{ formatBound(scale.min) }}</span>
      <span class="color-faint truncate text-right">{{ formatBound(scale.max) }}</span>
    </div>
  </div>
</template>
