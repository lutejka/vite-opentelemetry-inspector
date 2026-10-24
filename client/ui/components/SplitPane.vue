<!-- @description resizable split panes (wraps `splitpanes`), sizes persisted by `storageKey`. -->
<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import type { SplitpanesResizedPayload } from 'splitpanes'
import { Splitpanes } from 'splitpanes'

const { storageKey } = defineProps<{
  /** Persist pane sizes under this localStorage key (via VueUse). */
  storageKey: string
}>()

const sizes = useLocalStorage<number[]>(storageKey, [])

function onResized(payload: SplitpanesResizedPayload): void {
  sizes.value = payload.panes.map(p => p.size)
}
</script>

<template>
  <Splitpanes @resized="onResized">
    <slot :sizes="sizes" />
  </Splitpanes>
</template>
