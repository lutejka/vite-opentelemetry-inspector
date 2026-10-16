import { computed, nextTick, ref, watch } from 'vue'
import type { Ref } from 'vue'

const MIN_ZOOM = 1
const MAX_ZOOM = 64
const ZOOM_FACTOR = 1.15

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function useWaterfallZoom(containerRef: Ref<HTMLElement | null>) {
  const zoomLevel = ref(MIN_ZOOM)

  function zoomAt(factor: number, clientX: number) {
    const container = containerRef.value
    if (!container) return

    const nextZoom = clampZoom(zoomLevel.value * factor)
    if (nextZoom === zoomLevel.value) return

    const rect = container.getBoundingClientRect()
    const pointerX = clientX - rect.left
    const scrollRatio = (container.scrollLeft + pointerX) / container.scrollWidth

    zoomLevel.value = nextZoom

    nextTick(() => {
      if (!containerRef.value) return
      containerRef.value.scrollLeft = scrollRatio * containerRef.value.scrollWidth - pointerX
    })
  }

  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return

    event.preventDefault()
    const factor = event.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR
    zoomAt(factor, event.clientX)
  }

  function resetZoom() {
    zoomLevel.value = MIN_ZOOM
    if (containerRef.value) {
      containerRef.value.scrollLeft = 0
    }
  }

  watch(
    () => containerRef.value,
    (container, _, onCleanup) => {
      if (!container) return
      container.addEventListener('wheel', onWheel, { passive: false })
      onCleanup(() => container.removeEventListener('wheel', onWheel))
    },
    { immediate: true },
  )

  return {
    zoomLevel,
    resetZoom,
    isZoomed: computed(() => zoomLevel.value > MIN_ZOOM),
  }
}
