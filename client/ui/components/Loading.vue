<!-- @description a loading placeholder wrapping `Spinner`. -->
<script setup lang="ts">
import Spinner from './Spinner.vue'

defineProps<{
  text?: string
  /** Fill and center within the parent. */
  panel?: boolean
}>()
</script>

<template>
  <div
    class="op-fade flex gap-2 items-center justify-center"
    :class="panel ? 'h-full w-full py-12' : 'py-4'"
  >
    <Spinner />
    <span v-if="text || $slots.default" class="text-sm">
      <slot>{{ text }}</slot>
    </span>
  </div>
</template>
