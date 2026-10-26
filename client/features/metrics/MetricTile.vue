<script setup lang="ts">
import { computed } from 'vue'
import Badge from '~/ui/components/Badge.vue'
import Button from '~/ui/components/Button.vue'
import NumberDisplay from '~/ui/components/Number.vue'
import { resolveGaugeScale } from '~/utils/gauge'
import type { MetricGroup } from '~/utils/metrics'
import type { MetricType } from '~shared/types'
import MetricLineChart from './MetricLineChart.vue'
import MetricGauge from './MetricGauge.vue'

const TYPE_COLORS: Record<MetricType, string> = {
  counter: 'green',
  gauge: 'blue',
  histogram: 'amber',
}

const { group, pinned } = defineProps<{
  group: MetricGroup
  pinned: boolean
}>()

defineEmits<{
  'toggle-pin': []
  'open-chart': []
}>()

const typeColor = computed(() => TYPE_COLORS[group.type])
const gaugeScale = computed(() => resolveGaugeScale(group.sparklineValues))

/** Chronological aggregated values; the chart uses timestamps for hover labels. */
const sparklinePoints = computed(() =>
  group.samples.map(sample => ({ x: sample.timestamp, y: sample.value }))
)

const multiSeriesGauge = computed(() => group.type === 'gauge' && group.seriesCount > 1)
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border border-base bg-base p-3">
    <div class="flex items-center gap-1.5 min-w-0">
      <h3 class="text-sm font-medium color-base truncate" :title="group.name">
        {{ group.name }}
      </h3>
      <Badge :text="group.type" :color="typeColor" class="text-micro shrink-0" />
      <span class="flex-1" />
      <Button
        icon-only
        compact
        :icon="pinned ? 'icon-[ph--push-pin-fill]' : 'icon-[ph--push-pin]'"
        :active="pinned"
        label="Pin metric"
        @click="$emit('toggle-pin')"
      />
      <Button
        icon-only
        compact
        icon="icon-[ph--chart-line-up]"
        label="Show chart"
        @click="$emit('open-chart')"
      />
    </div>

    <div class="flex items-end justify-between gap-2">
      <div class="flex items-baseline gap-1 min-w-0">
        <span v-if="multiSeriesGauge" class="text-2xl font-semibold color-base">{{ group.seriesCount }} series</span>
        <template v-else>
          <NumberDisplay
            v-if="group.latestValue !== null"
            :value="group.latestValue"
            class="text-2xl font-semibold"
          />
          <span v-else class="text-2xl font-semibold color-faint">–</span>
          <span v-if="group.unit" class="text-xs color-faint truncate">{{ group.unit }}</span>
        </template>
      </div>
      <span class="text-micro color-faint shrink-0">
        {{ group.seriesCount > 1 ? `${group.seriesCount} series · ` : '' }}{{ group.dataPoints.length }} points
      </span>
    </div>

    <MetricGauge
      v-if="group.type === 'gauge' && !multiSeriesGauge"
      :value="group.latestValue"
      :scale="gaugeScale"
      :show-value="false"
      compact
    />

    <MetricLineChart
      v-else-if="sparklinePoints.length > 1 && !multiSeriesGauge"
      compact
      :height="32"
      :series="[{ key: 'aggregate', label: '', points: sparklinePoints }]"
      :unit="group.unit"
    />
  </div>
</template>
