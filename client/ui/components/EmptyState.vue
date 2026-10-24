<!-- @description an empty/zero-state placeholder — `icon`, `title`, `#hint`. -->
<script setup lang="ts">
const { title, icon } = defineProps<{
  title: string
  icon?: string
}>()
</script>

<template>
  <div class="px-6 py-10 text-center op-fade flex flex-col gap-2 items-center justify-center">
    <span v-if="icon" :class="icon" class="text-3xl op-mute" aria-hidden="true" />
    <div class="text-sm color-base font-medium">
      {{ title }}
    </div>
    <div v-if="$slots.hint" class="text-xs op-mute max-w-prose">
      <slot name="hint" />
    </div>
  </div>
</template>
