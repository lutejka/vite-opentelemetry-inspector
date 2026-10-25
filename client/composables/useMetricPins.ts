import { useStorage } from '@vueuse/core'
import type { Ref } from 'vue'

const pinnedNames = useStorage<string[]>('otel-metrics-pinned', [])

export function useMetricPins(): {
  pinnedNames: Ref<string[]>
  isPinned: (name: string) => boolean
  togglePin: (name: string) => void
} {
  function isPinned(name: string): boolean {
    return pinnedNames.value.includes(name)
  }

  function togglePin(name: string): void {
    pinnedNames.value = isPinned(name)
      ? pinnedNames.value.filter(pinned => pinned !== name)
      : [...pinnedNames.value, name]
  }

  return {
    pinnedNames,
    isPinned,
    togglePin,
  }
}
