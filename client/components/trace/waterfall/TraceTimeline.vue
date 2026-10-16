<template>
  <div class="flex h-8 w-full select-none items-center justify-between">
    <span
      v-for="(tick, index) in ticks"
      :key="index"
      class="text-micro color-faint font-mono tabular-nums whitespace-nowrap"
      :class="index === 0 ? 'text-left' : index === ticks.length - 1 ? 'text-right' : 'text-center'"
    >
      {{ tick }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDurationCompact } from '../../../utils/formatters'

const LABEL_COUNT = 6

const { traceDuration } = defineProps<{
  traceDuration: number
}>()

const ticks = computed(() => {
  const items: string[] = []
  for (let index = 0; index <= LABEL_COUNT; index++)
    items.push(formatDurationCompact((traceDuration / LABEL_COUNT) * index))
  return items
})
</script>
