<template>
  <div
    class="relative h-7 flex items-center rounded-r-md cursor-pointer transition-colors"
    :class="selected ? 'bg-active' : hovered ? 'bg-hover' : 'hover:bg-hover'"
    @click="$emit('select-span', row.span)"
    @mouseenter="$emit('hover', row.span.span_id)"
    @mouseleave="$emit('unhover')"
  >
    <div class="relative flex-1 h-full mx-1.5">
      <div
        class="absolute top-1/2 -translate-y-1/2 h-4 rounded-md transition"
        :style="barStyle"
        :title="`${row.span.name} — ${formatDuration(row.span.duration)}`"
      />
      <span
        v-for="(marker, idx) in eventMarkers"
        :key="idx"
        class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-1.5 rounded-full bg-white pointer-events-none"
        :style="{ left: `${marker.percent}%` }"
        :title="marker.name"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useColorScheme } from '~/ui/composables/colorScheme'
import { formatDuration } from '~/utils/formatters'
import { getDepthBarColor } from '~/utils/span-colors'
import type { FlatSpanRow } from '~/utils/span-tree'

const props = defineProps<{
  row: FlatSpanRow
  selected: boolean
  hovered: boolean
  traceStart: number
  traceDuration: number
}>()

defineEmits<{
  'select-span': [span: FlatSpanRow['span']]
  hover: [spanId: string]
  unhover: []
}>()

const scheme = useColorScheme()
const dark = computed(() => scheme.value === 'dark')

const barStyle = computed(() => {
  const left = Math.min(Math.max(props.row.offsetPercent, 0), 100)
  const width = Math.max(0.75, Math.min(props.row.widthPercent, 100 - left))
  return {
    left: `${left}%`,
    width: `${width}%`,
    minWidth: '3px',
    backgroundColor: getDepthBarColor(props.row.depth, props.row.span.status_code, dark.value),
  }
})

const eventMarkers = computed<Array<{ name: string; percent: number }>>(() => {
  if (!props.row.span.events?.length || !props.traceDuration) return []
  return props.row.span.events
    .map((event: { time: number; name: string }) => ({
      name: event.name,
      percent: ((event.time - props.traceStart) / props.traceDuration) * 100,
    }))
    .filter((marker: { percent: number }) => marker.percent >= 0 && marker.percent <= 100)
    .slice(0, 24)
})
</script>
