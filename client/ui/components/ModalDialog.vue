<!-- @description a modal dialog — teleported backdrop + centered scrollable panel with optional `title`; `v-model:open`, closes on Esc or backdrop click, default slot is the body. -->
<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import Button from './Button.vue'

const { title } = defineProps<{
  title?: string
}>()

const open = defineModel<boolean>('open', { required: true })

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', closeOnEscape)
    } else {
      window.removeEventListener('keydown', closeOnEscape)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/40 z-modal-backdrop flex items-center justify-center p-4"
      @click="open = false"
    >
      <div
        class="relative z-modal-content w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg border border-base bg-base shadow-lg"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.stop
      >
        <div class="flex items-center justify-between gap-2 border-b border-base px-3 py-2 shrink-0">
          <span class="text-sm color-base font-medium truncate">{{ title }}</span>
          <Button icon-only compact icon="icon-[ph--x]" label="Close" @click="open = false" />
        </div>
        <div class="flex-1 overflow-y-auto p-3 min-h-0">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
