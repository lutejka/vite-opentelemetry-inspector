<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMetricPins } from '~/composables/useMetricPins'
import { useMetrics } from '~/composables/useMetrics'
import Button from '~/ui/components/Button.vue'
import EmptyState from '~/ui/components/EmptyState.vue'
import NumberBadge from '~/ui/components/NumberBadge.vue'
import SearchField from '~/ui/components/SearchField.vue'
import Toolbar from '~/ui/components/Toolbar.vue'
import MetricChartDialog from './MetricChartDialog.vue'
import MetricTile from './MetricTile.vue'

const { groups, clearAllMetrics } = useMetrics()
const { isPinned, togglePin } = useMetricPins()

const query = ref('')
const selectedName = ref<string | null>(null)
const chartOpen = ref(false)

// Resolve against the live groups so a stale selection (e.g. after Clear) is null, never a crash.
const selectedGroup = computed(
  () => groups.value.find(group => group.name === selectedName.value) ?? null,
)

function openChart(name: string) {
  selectedName.value = name
  chartOpen.value = true
}

const visibleGroups = computed(() => {
  const needle = query.value.toLowerCase().trim()
  const filtered = needle
    ? groups.value.filter(group => group.name.toLowerCase().includes(needle))
    : groups.value

  return [...filtered].sort(
    (a, b) =>
      (Number(isPinned(b.name)) - Number(isPinned(a.name)))
      || a.name.localeCompare(b.name),
  )
})
</script>

<template>
  <div class="h-full flex flex-col bg-base min-h-0">
    <Toolbar>
      <template #start>
        <span class="text-sm color-base font-medium">Metrics</span>
        <NumberBadge :value="groups.length" />
      </template>
      <template #end>
        <SearchField v-model="query" size="sm" placeholder="Filter metrics…" />
        <Button size="sm" icon="icon-[ph--trash]" @click="clearAllMetrics">
          Clear
        </Button>
      </template>
    </Toolbar>

    <EmptyState
      v-if="groups.length === 0"
      icon="icon-[ph--chart-line-up-duotone]"
      title="No metrics yet"
    >
      <template #hint>
        Waiting for metrics from instrumented applications
      </template>
    </EmptyState>

    <EmptyState
      v-else-if="visibleGroups.length === 0"
      icon="icon-[ph--magnifying-glass-duotone]"
      title="No matching metrics"
    >
      <template #hint>
        No metrics found for "{{ query }}"
      </template>
    </EmptyState>

    <div v-else class="flex-1 overflow-y-auto p-3 min-h-0">
      <div class="grid gap-2 content-start grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <MetricTile
          v-for="group in visibleGroups"
          :key="group.name"
          :group="group"
          :pinned="isPinned(group.name)"
          @toggle-pin="togglePin(group.name)"
          @open-chart="openChart(group.name)"
        />
      </div>
    </div>

    <MetricChartDialog v-model:open="chartOpen" :group="selectedGroup" />
  </div>
</template>
