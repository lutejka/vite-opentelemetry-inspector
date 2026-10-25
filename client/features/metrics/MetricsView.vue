<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMetricPins } from '~/composables/useMetricPins'
import { useMetrics } from '~/composables/useMetrics'
import Button from '~/ui/components/Button.vue'
import EmptyState from '~/ui/components/EmptyState.vue'
import NumberBadge from '~/ui/components/NumberBadge.vue'
import SearchField from '~/ui/components/SearchField.vue'
import Toolbar from '~/ui/components/Toolbar.vue'
import { filterMetricGroups } from '~/utils/metrics'
import type { MetricTypeFilter } from '~/utils/metrics'
import MetricChartDialog from './MetricChartDialog.vue'
import MetricTile from './MetricTile.vue'

const { groups, clearAllMetrics } = useMetrics()
const { isPinned, togglePin } = useMetricPins()

const query = ref('')
const typeFilter = ref<MetricTypeFilter>('all')
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

const typeCounts = computed(() => {
  const counts: Record<MetricTypeFilter, number> = {
    all: groups.value.length,
    counter: 0,
    histogram: 0,
    gauge: 0,
  }
  for (const group of groups.value) counts[group.type]++
  return counts
})

const typeOptions = computed(() => [
  { value: 'all' as const, label: 'All', count: typeCounts.value.all },
  { value: 'counter' as const, label: 'Counter', count: typeCounts.value.counter },
  { value: 'histogram' as const, label: 'Histogram', count: typeCounts.value.histogram },
  { value: 'gauge' as const, label: 'Gauge', count: typeCounts.value.gauge },
])

const visibleGroups = computed(() => {
  const filtered = filterMetricGroups(groups.value, query.value, typeFilter.value)

  return [...filtered].sort(
    (a, b) =>
      (Number(isPinned(b.name)) - Number(isPinned(a.name)))
      || a.name.localeCompare(b.name),
  )
})

const emptyHint = computed(() => {
  const type = typeFilter.value === 'all' ? 'metrics' : `${typeFilter.value} metrics`
  const needle = query.value.trim()
  return needle
    ? `No ${type} found for "${needle}"`
    : `No ${type} collected yet`
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
        <label class="relative inline-flex items-center">
          <span class="sr-only">Filter by metric type</span>
          <select
            v-model="typeFilter"
            class="h-7 appearance-none rounded border border-base bg-raised pl-2 pr-7 text-sm color-base outline-none transition focus:ring-2 focus:ring-primary/40"
          >
            <option
              v-for="option in typeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }} ({{ option.count }})
            </option>
          </select>
          <span
            class="icon-[ph--caret-down] pointer-events-none absolute right-2 text-xs op-fade"
            aria-hidden="true"
          />
        </label>
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
        {{ emptyHint }}
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
