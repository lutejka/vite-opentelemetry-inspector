<!-- @description ms → human duration. -->
<script setup lang="ts">
import { computed } from 'vue'
import { formatDuration } from '../utils/format'

const { ms } = defineProps<{
  /** Duration in milliseconds. */
  ms: number
}>()

const parts = computed(() => formatDuration(ms))
</script>

<template>
  <span class="font-mono tabular-nums">{{ parts[0] }}<span class="text-xs ml-0.5 op-fade">{{ parts[1] }}</span></span>
</template>
