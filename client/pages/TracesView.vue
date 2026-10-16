<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="flex flex-1 overflow-hidden bg-base min-h-0">
    <LayoutSplitPane storage-key="traces-split" #default="{ sizes }" class="w-full">
      <Pane :size="sizes[0] ?? 30" :min-size="12">
        <TraceList
          v-model:selected-trace-id="selectedTraceId"
          :traces="filteredTraces"
          @clear-traces="clearTraces"
          @select-trace="selectedTraceId = $event"
        />
      </Pane>
      <Pane :size="sizes[1] ?? 70">
        <TraceDetail v-if="selectedTrace" :trace="selectedTrace" :spans="traceSpans" :loading="traceLoading" />
        <FeedbackEmptyState
          v-else
          icon="i-ph:tree-structure-duotone"
          title="No trace selected"
        >
          <template #hint>
            Select a trace from the list to view its waterfall timeline and span details
          </template>
        </FeedbackEmptyState>
      </Pane>
    </LayoutSplitPane>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Span } from '~shared/types'
import { useTraces } from '~/composables/useTraces'
import { useServiceFilter } from '~/composables/useServiceFilter'
import LayoutSplitPane from '@antfu/design/components/Layout/LayoutSplitPane.vue'
import FeedbackEmptyState from '@antfu/design/components/Feedback/FeedbackEmptyState.vue'
import { Pane } from 'splitpanes'
import TraceList from '~/components/TraceList.vue'
import TraceDetail from '~/components/TraceDetail.vue'

const selectedTraceId = ref<string | null>(null)

const { traces, getSpansForTrace, clearAllTraces } = useTraces()

const { filteredTraces } = useServiceFilter(traces)

const traceSpans = ref<Span[]>([])
const traceLoading = ref(false)

const clearTraces = async () => {
  selectedTraceId.value = null
  await clearAllTraces()
}

const selectedTrace = computed(() => {
  if (!selectedTraceId.value) return null
  return traces.value.find(t => t.trace_id === selectedTraceId.value) || null
})

watch(selectedTraceId, async (id) => {
  if (!id) {
    traceSpans.value = []
    return
  }
  traceLoading.value = true
  try {
    traceSpans.value = await getSpansForTrace(id)
  }
  finally {
    traceLoading.value = false
  }
})

watch(
  () => traces.value[0],
  (newTrace) => {
    if (newTrace && !selectedTraceId.value) {
      selectedTraceId.value = newTrace.trace_id
    }
  },
)

watch(
  () => filteredTraces.value[0],
  (newFirst) => {
    if (selectedTraceId.value && !traces.value.find(t => t.trace_id === selectedTraceId.value)) {
      selectedTraceId.value = newFirst?.trace_id || null
    }
  },
)
</script>
