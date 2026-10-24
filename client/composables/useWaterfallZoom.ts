import { computed, nextTick, ref, watch } from 'vue'
import type { Ref } from 'vue'

const MIN_ZOOM = 1
const MAX_ZOOM = 64
const ZOOM_FACTOR = 1.15

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export interface WaterfallZoomOptions {
  /** Visible width of the timeline column, in pixels. */
  viewportWidth: Ref<number>
  /** Width of the pinned name column, in pixels. */
  columnWidth: Ref<number>
  /** Distance between the timeline column edge and the time track, in pixels. */
  trackInset: number
}

export function useWaterfallZoom(containerRef: Ref<HTMLElement | null>, options: WaterfallZoomOptions) {
  const zoomLevel = ref(MIN_ZOOM)

  function trackWidthAt(zoom: number): number {
    return Math.max(1, options.viewportWidth.value * zoom - options.trackInset * 2)
  }

  function zoomAt(factor: number, clientX: number) {
    const container = containerRef.value
    const viewport = options.viewportWidth.value
    if (!container || viewport <= 0) return

    const nextZoom = clampZoom(zoomLevel.value * factor)
    if (nextZoom === zoomLevel.value) return

    const rect = container.getBoundingClientRect()
    const pointerX = clientX - rect.left
    const trackX = pointerX - options.columnWidth.value - options.trackInset + container.scrollLeft
    const ratio = Math.min(1, Math.max(0, trackX / trackWidthAt(zoomLevel.value)))

    zoomLevel.value = nextZoom

    nextTick(() => {
      const element = containerRef.value
      if (!element) return

      const nextTrack = trackWidthAt(zoomLevel.value)
      const nextContentWidth = nextTrack + options.trackInset * 2
      const target = ratio * nextTrack - pointerX + options.columnWidth.value + options.trackInset
      element.scrollLeft = Math.min(Math.max(0, target), Math.max(0, nextContentWidth - viewport))
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
