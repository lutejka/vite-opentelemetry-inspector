<!-- @description a vue-afloat tooltip — `content` text with a configurable `placement`. -->
<script setup lang="ts">
import { Tooltip as VTooltip } from 'vue-afloat'

const { content, placement = 'top' } = defineProps<{
  /** Tooltip text. */
  content?: string
  placement?: string
}>()
</script>

<template>
  <VTooltip :placement="placement as any" :distance="6">
    <slot />
    <template #popper>
      {{ content }}
    </template>
  </VTooltip>
</template>
