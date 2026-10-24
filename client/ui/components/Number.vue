<!-- @description a formatted (`Intl`) number. -->
<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '../utils/format'

const { value } = defineProps<{
  value: number
}>()

const formatted = computed(() => formatNumber(value))
</script>

<template>
  <span class="font-mono tabular-nums">{{ formatted }}</span>
</template>
