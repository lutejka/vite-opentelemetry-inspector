<!-- @description a single-line text input with an optional `#prefix` slot and `clearable` button. -->
<script setup lang="ts">
const {
  type = 'text',
  size = 'md',
} = defineProps<{
  clearable?: boolean
  placeholder?: string
  type?: string
  size?: 'sm' | 'md'
}>()

const model = defineModel<string>({ default: '' })
</script>

<template>
  <label
    class="px-2 border rounded bg-raised inline-flex gap-2 transition items-center focus-within:ring-2 border-base focus-within:ring-primary/40"
    :class="size === 'sm' ? 'h-7 text-sm' : 'h-9'"
  >
    <slot name="prefix" />
    <input
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      class="color-base outline-none bg-transparent flex-1 min-w-0 placeholder:op-mute"
    >
    <button
      v-if="clearable && model"
      type="button"
      class="op-fade shrink-0 transition hover:opacity-100"
      aria-label="Clear"
      @click="model = ''"
    >
      <span class="icon-[ph--x]" aria-hidden="true" />
    </button>
  </label>
</template>
