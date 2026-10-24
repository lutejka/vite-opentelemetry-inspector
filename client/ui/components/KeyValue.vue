<!-- @description a labeled stat — inline row or stacked. -->
<script setup lang="ts">
const { orientation = 'inline', label } = defineProps<{
  /** The label text. */
  label: string
  /** Inline row or stacked stat. */
  orientation?: 'inline' | 'stacked'
}>()
</script>

<template>
  <div
    v-if="orientation === 'stacked'"
    class="flex flex-col gap-0.5"
  >
    <span class="text-micro color-faint tracking-wide uppercase">{{ label }}</span>
    <span class="text-lg color-base flex gap-2 items-center font-mono tabular-nums">
      <slot />
    </span>
  </div>
  <div
    v-else
    class="flex gap-2 items-center justify-between"
  >
    <span class="text-sm color-muted">{{ label }}</span>
    <span class="text-sm color-base flex gap-2 items-center font-mono tabular-nums">
      <slot />
    </span>
  </div>
</template>
