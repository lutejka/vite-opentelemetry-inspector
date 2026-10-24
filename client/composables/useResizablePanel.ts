import { useEventListener, useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'

export function useResizablePanel(storageKey: string, defaultWidth: number, options?: { min?: number; max?: number }) {
  const min = options?.min ?? 280
  const max = options?.max ?? 800

  const width = useLocalStorage(storageKey, defaultWidth)

  const dragging = ref(false)

  function preventSelect(e: Event) {
    e.preventDefault()
  }

  function startDrag(e: MouseEvent, direction: 'left' | 'right') {
    e.preventDefault()
    dragging.value = true
    const startX = e.clientX
    const startWidth = width.value
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const clearSelectStart = useEventListener('selectstart', preventSelect)

    function onMouseMove(e: MouseEvent) {
      const delta = direction === 'right' ? startX - e.clientX : e.clientX - startX
      width.value = Math.min(max, Math.max(min, startWidth + delta))
    }

    function onMouseUp() {
      dragging.value = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      clearSelectStart()
      clearMouseMove()
      clearMouseUp()
    }

    const clearMouseMove = useEventListener('mousemove', onMouseMove)
    const clearMouseUp = useEventListener('mouseup', onMouseUp)
  }

  function onMouseDown(e: MouseEvent) {
    startDrag(e, 'right')
  }

  function onMouseDownLeft(e: MouseEvent) {
    startDrag(e, 'left')
  }

  return { width, dragging, onMouseDown, onMouseDownLeft }
}
