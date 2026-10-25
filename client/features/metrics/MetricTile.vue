<script setup lang="ts">
import { computed } from 'vue'
import { useMetricGaugeScales } from '~/composables/useMetricGaugeScales'
import Badge from '~/ui/components/Badge.vue'
import Button from '~/ui/components/Button.vue'
import NumberDisplay from '~/ui/components/Number.vue'
import { sparklinePath } from '~/utils/chart'
import { resolveGaugeScale } from '~/utils/gauge'
import type { MetricGroup } from '~/utils/metrics'
import type { MetricType } from '~shared/types'
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
const { overrides } = useMetricGaugeScales()
const gaugeScale = computed(() => resolveGaugeScale(group.sparklineValues, overrides.value[group.name] ?? null))
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
        <NumberDisplay
          v-if="group.latestValue !== null"
          :value="group.latestValue"
          class="text-2xl font-semibold"
        />
        <span v-else class="text-2xl font-semibold color-faint">–</span>
        <span v-if="group.unit" class="text-xs color-faint truncate">{{ group.unit }}</span>
      </div>
      <span class="text-micro color-faint shrink-0">{{ group.dataPoints.length }} points</span>
    </div>

    <MetricGauge
      v-if="group.type === 'gauge'"
      :value="group.latestValue"
      :scale="gaugeScale"
      :show-value="false"
      compact
    />

    <svg
      v-else-if="group.sparklineValues.length > 1"
      class="w-full h-8"
      preserveAspectRatio="none"
      :viewBox="`0 0 ${group.sparklineValues.length - 1} 1`"
    >
      <polyline
        :points="sparklinePath(group.sparklineValues)"
        fill="none"
        stroke="var(--color-primary)"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>
