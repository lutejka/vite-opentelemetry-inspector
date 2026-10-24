<!-- @description a `Number` in a muted badge shell — a count pill. -->
<script setup lang="ts">
import Badge from './Badge.vue'
import NumberDisplay from './Number.vue'

const { value } = defineProps<{
  value: number
}>()
</script>

<template>
  <Badge :color="false" class="text-micro">
    <NumberDisplay :value="value" />
  </Badge>
</template>
