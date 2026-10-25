<script setup lang="ts">
import { computed } from 'vue'
import Badge from '~/ui/components/Badge.vue'
import ModalDialog from '~/ui/components/ModalDialog.vue'
import NumberDisplay from '~/ui/components/Number.vue'
import type { ChartPoint } from '~/utils/chart'
import { resolveGaugeScale } from '~/utils/gauge'
import { metricPointValue, metricStats } from '~/utils/metrics'
import type { MetricGroup } from '~/utils/metrics'
import type { HistogramData, MetricType } from '~shared/types'
import MetricChart from './MetricChart.vue'
import MetricGauge from './MetricGauge.vue'
import MetricHistogramChart from './MetricHistogramChart.vue'

const TYPE_COLORS: Record<MetricType, string> = {
  counter: 'green',
  gauge: 'blue',
  histogram: 'amber',
}

const { group } = defineProps<{
  group: MetricGroup | null
}>()

const open = defineModel<boolean>('open', { required: true })

const typeColor = computed(() => (group ? TYPE_COLORS[group.type] : 'gray'))

const stats = computed(() => (group ? metricStats(group.dataPoints) : null))

/** Oldest first; drop points with no numeric value or a non-finite timestamp. */
const chartPoints = computed<ChartPoint[]>(() => {
  if (!group) return []
  return [...group.dataPoints]
    .reverse()
    .map(dataPoint => ({ x: dataPoint.timestamp, y: metricPointValue(dataPoint) }))
    .filter((point): point is ChartPoint => point.y !== null && Number.isFinite(point.y) && Number.isFinite(point.x))
})

/** Histogram metrics plot their bucket distribution, not a line of averages. */
const latestHistogram = computed<HistogramData | null>(() => {
  if (!group || group.type !== 'histogram') return null
  return group.latestHistogram
})

const gaugeScale = computed(() => resolveGaugeScale(group?.sparklineValues ?? []))

const statItems = computed(() => [
  { label: 'Latest', value: group?.latestValue ?? null },
  { label: 'Min', value: stats.value?.min ?? null },
  { label: 'Max', value: stats.value?.max ?? null },
  { label: 'Avg', value: stats.value?.avg ?? null },
  { label: 'Points', value: group?.dataPoints.length ?? null },
])
</script>

<template>
  <ModalDialog v-model:open="open" :title="group?.name ?? ''">
    <div v-if="group" class="flex flex-col gap-3">
      <p v-if="group.description" class="text-sm color-muted">{{ group.description }}</p>

      <div class="flex items-center gap-2 flex-wrap">
        <Badge :text="group.type" :color="typeColor" class="text-micro" />
        <span v-if="group.unit" class="text-xs color-faint">Unit: {{ group.unit }}</span>
      </div>

      <template v-if="group.type === 'gauge'">
        <MetricGauge :value="group.latestValue" :scale="gaugeScale" :unit="group.unit" />
      </template>

      <dl class="grid grid-cols-5 gap-2">
        <div v-for="item in statItems" :key="item.label" class="flex flex-col gap-0.5">
          <dt class="text-micro color-faint font-medium uppercase tracking-wide">{{ item.label }}</dt>
          <dd class="text-sm color-base">
            <NumberDisplay v-if="item.value !== null" :value="item.value" />
            <span v-else class="color-faint">–</span>
          </dd>
        </div>
      </dl>

      <template v-if="group.type === 'gauge'">
        <p class="text-micro color-faint font-medium uppercase tracking-wide">History</p>
        <MetricChart :points="chartPoints" :unit="group.unit" />
      </template>
      <template v-else-if="latestHistogram">
        <p class="text-micro color-faint">Bucket distribution of the latest data point</p>
        <MetricHistogramChart :histogram="latestHistogram" :unit="group.unit" />
      </template>
      <MetricChart v-else :points="chartPoints" :unit="group.unit" />
    </div>
  </ModalDialog>
</template>
