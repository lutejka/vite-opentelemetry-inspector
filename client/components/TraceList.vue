<template>
  <div class="h-full flex flex-col bg-base min-h-0">
    <LayoutToolbar>
      <template #start>
        <span class="text-sm color-base font-medium">Traces</span>
        <DisplayNumberBadge :value="traces?.length ?? 0" />
      </template>
      <template #end>
        <ActionButton size="sm" icon="i-ph:trash" @click="$emit('clear-traces')">
          Clear
        </ActionButton>
      </template>
    </LayoutToolbar>
    <div class="px-3 py-2 border-b border-base">
      <FormSearchField v-model="searchQuery" placeholder="Search traces..." size="sm" class="w-full" />
    </div>

    <div class="flex-1 overflow-y-auto min-h-0">
      <FeedbackEmptyState
        v-if="traces.length === 0"
        icon="i-ph:tree-structure-duotone"
        title="No traces yet"
      >
        <template #hint>
          Waiting for traces from instrumented applications
        </template>
      </FeedbackEmptyState>

      <FeedbackEmptyState
        v-else-if="searchQuery && filteredTraces.length === 0"
        icon="i-ph:magnifying-glass-duotone"
        title="No traces found"
      >
        <template #hint>
          No traces found for "{{ searchQuery }}"
        </template>
      </FeedbackEmptyState>

      <template v-else>
        <TraceCard
          v-for="trace in filteredTraces"
          :key="trace.trace_id"
          :trace="trace"
          :is-selected="selectedTraceId === trace.trace_id"
          @select="(id: string) => $emit('select-trace', id)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionButton from '@antfu/design/components/Action/ActionButton.vue'
import DisplayNumberBadge from '@antfu/design/components/Display/DisplayNumberBadge.vue'
import FeedbackEmptyState from '@antfu/design/components/Feedback/FeedbackEmptyState.vue'
import FormSearchField from '@antfu/design/components/Form/FormSearchField.vue'
import LayoutToolbar from '@antfu/design/components/Layout/LayoutToolbar.vue'
import { computed, ref } from 'vue'
import TraceCard from '~/components/TraceCard.vue'
import type { Trace } from '~shared/types'

const { traces = [], selectedTraceId = null } = defineProps<{
  traces?: Trace[]
  selectedTraceId?: string | null
}>()

defineEmits<{
  'select-trace': [traceId: string]
  'clear-traces': []
}>()

const searchQuery = ref('')

const filteredTraces = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return traces
  return traces.filter(
    t =>
      t.trace_id?.toLowerCase().includes(query)
      || t.service_name?.toLowerCase().includes(query)
      || t.operation_name?.toLowerCase().includes(query),
  )
})
</script>
