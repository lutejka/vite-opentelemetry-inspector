<template>
  <div class="w-full h-full flex overflow-hidden min-h-0">
    <main class="flex-1 min-h-0 overflow-hidden relative bg-base flex flex-col min-w-0">
      <TraceWaterfall
        v-if="trace && spans.length > 0"
        class="flex-1 min-h-0"
        :trace="trace"
        :spans="spans"
        :selected-span-id="selectedSpan?.span_id ?? null"
        @select-span="selectedSpan = $event"
      />
      <FeedbackLoading v-else-if="loading" panel text="Loading trace details..." class="flex-1 min-h-0" />
      <FeedbackEmptyState
        v-else
        icon="i-ph:tree-structure-duotone"
        title="No spans found for this trace"
        class="flex-1 min-h-0"
      />
    </main>

    <template v-if="selectedSpan">
      <aside
        ref="spanDetails"
        class="absolute right-0 top-0 bottom-0 z-drawer-content bg-base border-l border-t border-base rounded-tl-xl shadow-2xl overflow-hidden shrink-0 flex"
        :style="{ width: spanPanelWidth + 'px' }"
      >
        <div
          class="w-1 shrink-0 cursor-col-resize hover:bg-primary-500/40 transition-colors"
          :class="{ 'bg-primary-500/40': spanPanelDragging }"
          @mousedown="onSpanPanelMouseDown"
        />
        <SpanDetails class="flex-1 min-w-0" :span="selectedSpan" @close="selectedSpan = undefined" />
      </aside>
    </template>
  </div>
</template>

<script setup lang="ts">
import FeedbackEmptyState from '@antfu/design/components/Feedback/FeedbackEmptyState.vue'
import FeedbackLoading from '@antfu/design/components/Feedback/FeedbackLoading.vue'
import { ref, useTemplateRef, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import type { Trace, Span } from '~shared/types'
import { useResizablePanel } from '../composables/useResizablePanel'
import TraceWaterfall from '~/components/trace/waterfall/TraceWaterfall.vue'
import SpanDetails from '~/components/SpanDetails.vue'

const props = defineProps<{
  trace: Trace
  spans: Span[]
  loading?: boolean
}>()

const selectedSpan = ref<Span | undefined>()
const {
  width: spanPanelWidth,
  dragging: spanPanelDragging,
  onMouseDown: onSpanPanelMouseDown,
} = useResizablePanel('span-panel-width', 380)

watch(
  () => props.trace.trace_id,
  () => {
    selectedSpan.value = undefined
  },
)

const spanDetails = useTemplateRef('spanDetails')
onClickOutside(spanDetails, () => {
  selectedSpan.value = undefined
})
</script>
