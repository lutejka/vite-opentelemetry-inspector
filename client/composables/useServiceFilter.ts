import type { MaybeRefOrGetter } from 'vue'
import { computed, readonly, ref, toValue, watch } from 'vue'
import type { Trace } from '~shared/types'

export function useServiceFilter(traces: MaybeRefOrGetter<Trace[]>) {
  const selectedServices = ref<Set<string>>(new Set())

  const availableServices = computed(() => {
    const services = new Set<string>()
    for (const trace of toValue(traces)) {
      services.add(trace.service_name)
    }
    return Array.from(services).sort()
  })

  const hasMultipleServices = computed(() => availableServices.value.length >= 2)

  watch(
    availableServices,
    (services) => {
      selectedServices.value = new Set(services)
    },
    { immediate: true },
  )

  const filteredTraces = computed(() => {
    if (!hasMultipleServices.value) return toValue(traces)
    return toValue(traces).filter((t: Trace) => selectedServices.value.has(t.service_name))
  })

  function toggleService(name: string) {
    const next = new Set(selectedServices.value)
    if (next.has(name)) {
      next.delete(name)
    }
    else {
      next.add(name)
    }
    selectedServices.value = next
  }

  return {
    availableServices,
    selectedServices: readonly(selectedServices),
    hasMultipleServices,
    filteredTraces,
    toggleService,
  }
}
