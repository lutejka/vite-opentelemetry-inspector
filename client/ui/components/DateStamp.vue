<!-- @description relative time + exact-date tooltip. -->
<script setup lang="ts">
import { computed } from 'vue'
import { vTooltip } from 'vue-afloat'
import { formatDateTime, formatTimeAgo } from '../utils/format'

const { date } = defineProps<{
  date: number | string | Date
}>()

const time = computed(() => new Date(date).getTime())
const relative = computed(() => formatTimeAgo(time.value, Date.now()))
const exact = computed(() => formatDateTime(time.value))
</script>

<template>
  <time v-tooltip="exact" :datetime="new Date(time).toISOString()">
    <slot :relative="relative" :exact="exact">{{ relative }}</slot>
  </time>
</template>
