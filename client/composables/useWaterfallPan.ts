import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

export function useWaterfallPan(containerRef: Ref<HTMLElement | null>) {
  const isPanning = ref(false)

  let panStartX = 0
  let panStartY = 0
  let panStartScrollLeft = 0
  let panStartScrollTop = 0

  function onPanMouseMove(event: MouseEvent) {
    const container = containerRef.value
    if (!isPanning.value || !container) return

    container.scrollLeft = panStartScrollLeft + (panStartX - event.clientX)
    container.scrollTop = panStartScrollTop + (panStartY - event.clientY)
  }

  function onPanMouseUp() {
    isPanning.value = false
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onPanMouseMove)
    document.removeEventListener('mouseup', onPanMouseUp)
  }

  function onMouseDown(event: MouseEvent) {
    if (event.button !== 0) return

    const target = event.target as HTMLElement
    if (target.closest('button')) return

    isPanning.value = true
    panStartX = event.clientX
    panStartY = event.clientY

    const container = containerRef.value
    if (container) {
      panStartScrollLeft = container.scrollLeft
      panStartScrollTop = container.scrollTop
    }

    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onPanMouseMove)
    document.addEventListener('mouseup', onPanMouseUp)
  }

  onUnmounted(onPanMouseUp)

  return {
    isPanning,
    onMouseDown,
  }
}
