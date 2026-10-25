import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import { useOtelStore } from '~/app/otel'
import type { Metric } from '../../src/types.ts'
import type { MetricGroup } from '../utils/metrics'
import { groupMetrics } from '../utils/metrics'

export function useMetrics(): {
  metrics: Ref<Metric[]>
  groups: ComputedRef<MetricGroup[]>
  clearAllMetrics: () => Promise<void>
} {
  const { metrics, clearAllMetrics } = useOtelStore()
  const groups = computed(() => groupMetrics(metrics.value))

  return {
    metrics,
    groups,
    clearAllMetrics,
  }
}
