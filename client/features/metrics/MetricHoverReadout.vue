<!-- @description floating chart-hover readout: optional time above the formatted value/unit, or one row per series; anchored to a 0–1 x fraction and optionally to a vertical point position. -->
<script setup lang="ts">
import { computed } from 'vue'

const { fraction, top = null, time = null, value = null, unit = null, entries = null, below = false } = defineProps<{
  /** Horizontal position in the hovered plot, 0–1. */
  fraction: number
  /** Optional vertical anchor (CSS length); omit to sit above the parent element. */
  top?: string | null
  /** Optional sample time, shown above the value. */
  time?: string | null
  /** Already-formatted single value. Ignored when `entries` is non-empty. */
  value?: string | null
  unit?: string | null
  /** One row per visible series. */
  entries?: { label: string; value: string; color: string }[] | null
  /** Place the box below the anchor instead of above it (for dots near the top edge). */
  below?: boolean
}>()

/** Keep a large breakdown readable inside the dialog; the legend can hide rows. */
const MAX_ENTRIES = 8

const visibleEntries = computed(() => (entries ?? []).slice(0, MAX_ENTRIES))
const hiddenCount = computed(() => Math.max(0, (entries?.length ?? 0) - visibleEntries.value.length))

/** Edge positions pin the box inward instead of letting it overflow the plot. */
const anchor = computed(() => {
  if (fraction <= 0.15) return 'left'
  if (fraction >= 0.85) return 'right'
  return 'center'
})

const transform = computed(() => {
  const x = anchor.value === 'left' ? '0' : anchor.value === 'right' ? '-100%' : '-50%'
  if (below && top !== null) return `translate(${x}, 6px)`
  return top === null ? `translateX(${x})` : `translate(${x}, calc(-100% - 6px))`
})

const hasEntries = computed(() => visibleEntries.value.length > 0)
</script>

<template>
  <div
    class="pointer-events-none absolute z-tooltip whitespace-nowrap rounded-md border border-base bg-raised px-2 py-1 shadow-md"
    :class="top === null && !below ? 'bottom-full mb-1.5' : ''"
    :style="{ left: `${fraction * 100}%`, top: top ?? undefined, transform }"
    role="tooltip"
  >
    <div v-if="time" class="text-micro color-faint">
      {{ time }}<span v-if="hasEntries && unit"> · {{ unit }}</span>
    </div>

    <div v-if="hasEntries" class="flex flex-col gap-0.5">
      <div
        v-for="(entry, index) in visibleEntries"
        :key="index"
        class="flex items-center gap-1.5 text-xs"
      >
        <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: entry.color }" />
        <span class="color-faint">{{ entry.label }}</span>
        <span class="ml-auto pl-3 font-medium color-base tabular-nums">{{ entry.value }}</span>
      </div>
      <div v-if="hiddenCount > 0" class="text-micro color-faint">+{{ hiddenCount }} more</div>
    </div>

    <div v-else class="text-xs font-medium color-base tabular-nums">
      {{ value ?? '' }}<span v-if="unit" class="color-faint"> {{ unit }}</span>
    </div>
  </div>
</template>
