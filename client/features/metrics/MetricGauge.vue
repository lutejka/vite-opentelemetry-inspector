<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '~/ui/utils/format'
import { gaugeFraction, gaugeValueOutsideScale } from '~/utils/gauge'
import type { GaugeScale } from '~/utils/gauge'

const { value, scale, unit = null, showValue = true, compact = false } = defineProps<{
  value: number | null
  scale: GaugeScale
  unit?: string | null
  showValue?: boolean
  compact?: boolean
}>()

const fractionPercent = computed(() => gaugeFraction(value, scale) * 100)
const outsideScale = computed(() => gaugeValueOutsideScale(value, scale))
const valueText = computed(() => value === null ? '–' : formatNumber(value, { maximumFractionDigits: 2 }))

const ariaLabel = computed(() =>
  `${valueText.value}${unit ? ` ${unit}` : ''} on a scale from ${formatBound(scale.min)} to ${formatBound(scale.max)}`
)

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
    :title="ariaLabel"
  >
    <div v-if="showValue" class="flex items-baseline justify-center gap-1 min-w-0">
      <span class="text-2xl font-semibold font-mono tabular-nums truncate">{{ valueText }}</span>
      <span v-if="unit" class="text-xs color-faint truncate">{{ unit }}</span>
    </div>

    <div class="relative flex items-center" :class="compact ? 'h-4' : 'h-7'">
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
    </div>

    <div class="flex justify-between gap-2" :class="compact ? 'text-micro' : 'text-xs'">
      <span class="color-faint truncate">{{ formatBound(scale.min) }}</span>
      <span class="color-faint truncate text-right">{{ formatBound(scale.max) }}</span>
    </div>

    <p v-if="outsideScale && showValue" class="text-micro text-warning text-center">
      Latest value is outside the configured scale
    </p>
  </div>
</template>
