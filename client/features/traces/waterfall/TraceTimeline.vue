<template>
  <div class="relative h-8 w-full select-none overflow-hidden">
    <span
      v-for="tick in ticks"
      :key="tick.time"
      class="absolute inset-y-0 flex items-center text-micro color-faint font-mono tabular-nums whitespace-nowrap"
      :style="tickStyle(tick)"
    >
      {{ formatDurationCompact(tick.time) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDurationCompact } from '~/utils/formatters'
import { getTimeTicks } from '~/utils/ticks'
import type { TimeTick } from '~/utils/ticks'

const props = withDefaults(
  defineProps<{
    traceDuration: number
    /** Width of the time track (between the horizontal insets), in pixels. */
    contentWidth: number
    /** Visible width of the timeline column, in pixels. */
    viewportWidth: number
    scrollLeft: number
    /** Distance between the column edge and the track, in pixels. */
    inset?: number
  }>(),
  { inset: 0 },
)

const EDGE_THRESHOLD = 32

const ticks = computed(() =>
  getTimeTicks({
    duration: props.traceDuration,
    contentWidth: props.contentWidth,
    viewportWidth: props.viewportWidth,
    scrollLeft: props.scrollLeft,
    inset: props.inset,
  })
)

function tickStyle(tick: TimeTick) {
  const left = Math.max(0, tick.left)
  if (left <= EDGE_THRESHOLD) return { left: `${left}px` }
  if (left >= props.viewportWidth - EDGE_THRESHOLD) {
    return { left: `${left}px`, transform: 'translateX(-100%)' }
  }
  return { left: `${left}px`, transform: 'translateX(-50%)' }
}
</script>
