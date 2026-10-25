<!-- @description floating chart-hover readout: optional time above the formatted value/unit, anchored to a 0–1 x fraction and optionally to a vertical point position. -->
<script setup lang="ts">
import { computed } from 'vue'

const { fraction, top = null, time = null, value, unit = null } = defineProps<{
  /** Horizontal position in the hovered plot, 0–1. */
  fraction: number
  /** Optional vertical anchor (CSS length); omit to sit above the parent element. */
  top?: string | null
  /** Optional sample time, shown above the value. */
  time?: string | null
  /** Already-formatted value. */
  value: string
  unit?: string | null
}>()

/** Edge positions pin the box inward instead of letting it overflow the plot. */
const anchor = computed(() => {
  if (fraction <= 0.15) return 'left'
  if (fraction >= 0.85) return 'right'
  return 'center'
})

const transform = computed(() => {
  const x = anchor.value === 'left' ? '0' : anchor.value === 'right' ? '-100%' : '-50%'
  return top === null ? `translateX(${x})` : `translate(${x}, calc(-100% - 6px))`
})
</script>

<template>
  <div
    class="pointer-events-none absolute z-tooltip whitespace-nowrap rounded-md border border-base bg-raised px-2 py-1 shadow-md"
    :class="top === null ? 'bottom-full mb-1.5' : ''"
    :style="{ left: `${fraction * 100}%`, top: top ?? undefined, transform }"
    role="tooltip"
  >
    <div v-if="time" class="text-micro color-faint">{{ time }}</div>
    <div class="text-xs font-medium color-base tabular-nums">
      {{ value }}<span v-if="unit" class="color-faint"> {{ unit }}</span>
    </div>
  </div>
</template>
