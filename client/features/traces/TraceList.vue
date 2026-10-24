<template>
  <div class="h-full flex flex-col bg-base min-h-0">
    <Toolbar>
      <template #start>
        <span class="text-sm color-base font-medium">Traces</span>
        <NumberBadge :value="traces?.length ?? 0" />
      </template>
      <template #end>
        <Button size="sm" icon="icon-[ph--trash]" @click="$emit('clear-traces')">
          Clear
        </Button>
      </template>
    </Toolbar>
    <div class="px-3 py-2 border-b border-base">
      <SearchField v-model="searchQuery" placeholder="Search traces..." size="sm" class="w-full" />
    </div>

    <div class="flex-1 overflow-y-auto min-h-0">
      <EmptyState
        v-if="traces.length === 0"
        icon="icon-[ph--tree-structure-duotone]"
        title="No traces yet"
      >
        <template #hint>
          Waiting for traces from instrumented applications
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="searchQuery && filteredTraces.length === 0"
        icon="icon-[ph--magnifying-glass-duotone]"
        title="No traces found"
      >
        <template #hint>
          No traces found for "{{ searchQuery }}"
        </template>
      </EmptyState>

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
import { computed, ref } from 'vue'
import Button from '~/ui/components/Button.vue'
import EmptyState from '~/ui/components/EmptyState.vue'
import NumberBadge from '~/ui/components/NumberBadge.vue'
import SearchField from '~/ui/components/SearchField.vue'
import Toolbar from '~/ui/components/Toolbar.vue'
import type { Trace } from '~shared/types'
import TraceCard from './TraceCard.vue'

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
