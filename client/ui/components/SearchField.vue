<!-- @description a search input — icon + clear button. -->
<script setup lang="ts">
import TextInput from './TextInput.vue'

const { placeholder = 'Search…', size } = defineProps<{
  placeholder?: string
  size?: 'sm' | 'md'
}>()

const model = defineModel<string>({ default: '' })
</script>

<template>
  <TextInput v-model="model" :placeholder="placeholder" :size="size" clearable type="search">
    <template #prefix>
      <span class="icon-[ph--magnifying-glass] op-fade shrink-0" aria-hidden="true" />
    </template>
  </TextInput>
</template>
