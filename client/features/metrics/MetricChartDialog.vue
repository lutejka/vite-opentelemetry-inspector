<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Badge from '~/ui/components/Badge.vue'
import ModalDialog from '~/ui/components/ModalDialog.vue'
import NumberDisplay from '~/ui/components/Number.vue'
import type { ChartSeries } from '~/utils/chart'
import { resolveGaugeScale } from '~/utils/gauge'
import { breakdownKeys, breakdownSeries, latestSeries, sampleStats } from '~/utils/metrics'
import type { MetricGroup } from '~/utils/metrics'
import type { HistogramData, MetricType } from '~shared/types'
import MetricLineChart from './MetricLineChart.vue'
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

/** Empty string means the aggregate series. */
const breakdownKey = ref('')
const labelKeys = computed(() => (group ? breakdownKeys(group.dataPoints) : []))

/** Histogram metrics also plot their bucket distribution. */
const latestHistogram = computed<HistogramData | null>(() => {
  if (!group || group.type !== 'histogram') return null
  return group.latestHistogram
})

/** Gauges show one real series; the selector makes the choice explicit. */
const gaugeSeriesOptions = computed(() =>
  group?.type === 'gauge' ? latestSeries(group.dataPoints) : []
)
const gaugeSeriesKey = ref('')
const selectedGauge = computed(
  () => gaugeSeriesOptions.value.find(series => series.key === gaugeSeriesKey.value)
    ?? gaugeSeriesOptions.value[0]
    ?? null,
)
const gaugeScale = computed(() =>
  resolveGaugeScale(selectedGauge.value?.values ?? group?.sparklineValues ?? [])
)

/**
 * The aggregate unless a breakdown is selected. For gauges the default history
 * follows the selected gauge series so the gauge and the line agree; the
 * `__all__` option exposes the cross-series aggregate.
 */
const AGGREGATE_KEY = '__all__'

const chartSeries = computed<ChartSeries[]>(() => {
  if (!group) return []
  if (group.type === 'gauge' && breakdownKey.value === '' && selectedGauge.value) {
    return [{
      key: selectedGauge.value.key,
      label: selectedGauge.value.label,
      points: selectedGauge.value.samples.map(sample => ({ x: sample.timestamp, y: sample.value })),
    }]
  }

  const attribute = breakdownKey.value && breakdownKey.value !== AGGREGATE_KEY
    ? breakdownKey.value
    : null
  return breakdownSeries(group.dataPoints, attribute).map(series => ({
    key: series.label || 'aggregate',
    label: series.label,
    points: series.samples.map(sample => ({ x: sample.timestamp, y: sample.value })),
  }))
})

/** A gauge's stats follow its selected series; other types use the aggregate line. */
const stats = computed(() => {
  if (!group) return null
  if (group.type === 'gauge' && selectedGauge.value) {
    const values = selectedGauge.value.values
    if (values.length === 0) return null
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let sum = 0
    for (const value of values) {
      min = Math.min(min, value)
      max = Math.max(max, value)
      sum += value
    }
    return { min, max, avg: sum / values.length }
  }
  return sampleStats(group.samples)
})

watch(() => group?.name, () => {
  breakdownKey.value = ''
  gaugeSeriesKey.value = gaugeSeriesOptions.value[0]?.key ?? ''
})

watch([labelKeys, () => group?.type], ([keys, type]) => {
  if (breakdownKey.value === AGGREGATE_KEY) {
    if (type !== 'gauge') breakdownKey.value = ''
    return
  }
  if (breakdownKey.value && !keys.includes(breakdownKey.value)) breakdownKey.value = ''
})

watch(gaugeSeriesOptions, (options) => {
  if (!options.some(option => option.key === gaugeSeriesKey.value)) {
    gaugeSeriesKey.value = options[0]?.key ?? ''
  }
})

const statItems = computed(() => {
  const latest = group?.type === 'gauge'
    ? selectedGauge.value?.value ?? group.latestValue
    : group?.latestValue ?? null
  return [
    { label: 'Latest', value: latest },
    { label: 'Min', value: stats.value?.min ?? null },
    { label: 'Max', value: stats.value?.max ?? null },
    { label: 'Avg', value: stats.value?.avg ?? null },
    { label: 'Points', value: group?.dataPoints.length ?? null },
  ]
})
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
        <label v-if="gaugeSeriesOptions.length > 1" class="flex items-center justify-end gap-1 text-xs">
          <span class="color-faint">Series</span>
          <select
            v-model="gaugeSeriesKey"
            class="h-7 rounded border border-base bg-raised px-2 text-sm color-base outline-none transition focus:ring-2 focus:ring-primary/40"
          >
            <option v-for="option in gaugeSeriesOptions" :key="option.key" :value="option.key">
              {{ option.label }}
            </option>
          </select>
        </label>
        <MetricGauge
          :value="selectedGauge?.value ?? group.latestValue"
          :scale="gaugeScale"
          :unit="group.unit"
        />
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

      <template v-if="group.type === 'histogram' && latestHistogram">
        <p class="text-micro color-faint">Bucket distribution (all series)</p>
        <MetricHistogramChart :histogram="latestHistogram" :unit="group.unit" />
      </template>

      <template v-if="group.type !== 'histogram' && (chartSeries.length > 0 || labelKeys.length > 0)">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <p class="text-micro color-faint font-medium uppercase tracking-wide">History</p>
          <label v-if="labelKeys.length > 0 || group.type === 'gauge'" class="flex items-center gap-1 text-xs">
            <span class="color-faint">Break down by</span>
            <select
              v-model="breakdownKey"
              class="h-7 rounded border border-base bg-raised px-2 text-sm color-base outline-none transition focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{{ group.type === 'gauge' ? 'Selected series' : 'None (aggregate)' }}</option>
              <option v-if="group.type === 'gauge'" :value="AGGREGATE_KEY">All series (aggregate)</option>
              <option v-for="key in labelKeys" :key="key" :value="key">{{ key }}</option>
            </select>
          </label>
        </div>
        <MetricLineChart :series="chartSeries" :unit="group.unit" />
      </template>
    </div>
  </ModalDialog>
</template>
