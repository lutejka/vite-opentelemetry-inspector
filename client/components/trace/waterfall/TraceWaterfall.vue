<template>
  <div class="h-full min-h-0 flex flex-col bg-base">
    <header class="border-b border-base bg-secondary shrink-0">
      <div class="px-3 pt-2 pb-2">
        <div class="flex items-center justify-between gap-2 min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="size-1.5 rounded-full shrink-0"
              :class="isError ? 'bg-error-500' : 'bg-success-500'"
              :title="isError ? 'Error' : 'OK'"
            />
            <h2 class="text-sm color-base font-medium truncate" :title="trace.operation_name">
              {{ trace.operation_name }}
            </h2>
          </div>
          <DisplayBadge :color="statusColor" class="uppercase text-mini justify-self-center">
            {{ statusText }}
          </DisplayBadge>
        </div>

        <div class="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-mini">
          <DisplayKeyValue orientation="inline" label="Service">
            <span class="font-medium">{{ trace.service_name }}</span>
          </DisplayKeyValue>
          <DisplayKeyValue orientation="inline" label="Duration">
            <DisplayDuration :ms="trace.duration" />
          </DisplayKeyValue>
          <DisplayKeyValue orientation="inline" label="Spans">
            <DisplayNumber :value="spans.length" />
          </DisplayKeyValue>
          <span v-if="errorCount > 0" class="color-scale-critical tabular-nums">
            <DisplayNumber :value="errorCount" /> error{{ errorCount === 1 ? '' : 's' }}
          </span>
          <span class="ml-auto flex items-center gap-1.5">
            <ActionButton variant="text" size="sm" @click="expandAll">
              Expand all
            </ActionButton>
            <ActionButton variant="text" size="sm" @click="collapseAll">
              Collapse all
            </ActionButton>
            <ActionButton v-if="isZoomed" variant="text" size="sm" @click="resetZoom">
              Reset zoom
            </ActionButton>
          </span>
        </div>

        <div
          v-if="isError && trace.status_message"
          class="mt-2 text-mini color-scale-critical truncate"
          :title="trace.status_message"
        >
          {{ trace.status_message }}
        </div>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden min-h-0">
      <aside
        ref="leftPanel"
        class="overflow-auto shrink-0 bg-base"
        :style="{ width: `${nameColWidth}px` }"
        @scroll="syncScrollFromLeft"
      >
        <div class="sticky top-0 z-nav bg-base border-b border-base h-8 flex items-center px-3">
          <span class="text-micro color-faint font-medium uppercase tracking-wide">Name</span>
          <span class="text-micro color-faint font-medium uppercase tracking-wide ml-auto">Duration</span>
        </div>
        <div class="py-1.5 pl-1.5 space-y-px" @mouseleave="hoveredSpanId = null">
          <SpanRowName
            v-for="row in flatRows"
            :key="row.span.span_id"
            :row="row"
            :expanded="isExpanded(row.span.span_id)"
            :selected="row.span.span_id === selectedSpanId"
            :hovered="row.span.span_id === hoveredSpanId"
            @select-span="$emit('select-span', $event)"
            @toggle="toggleShowChildren"
            @hover="hoveredSpanId = $event"
            @unhover="hoveredSpanId = null"
          />
        </div>
      </aside>

      <div
        class="shrink-0 w-0 cursor-col-resize -mx-px px-px border-l border-base hover:border-active transition-colors"
        :class="{ 'border-active!': nameColDragging }"
        @mousedown="onNameColMouseDown"
      />

      <section
        ref="timelineContainer"
        class="flex-1 overflow-auto bg-base cursor-grab min-w-0"
        :class="{ 'cursor-grabbing': isPanning }"
        @scroll="syncScrollFromRight"
        @mousedown="onTimelineMouseDown"
      >
        <div class="min-h-full" :style="timelineContentStyle">
          <div class="sticky top-0 z-nav bg-base border-b border-base h-8 pr-1.5">
            <div class="mx-1.5 h-full">
              <TraceTimeline :trace-duration="traceBounds.traceDuration" />
            </div>
          </div>

          <div class="py-1.5 pr-1.5 space-y-px" @mouseleave="hoveredSpanId = null">
            <SpanRowBar
              v-for="row in flatRows"
              :key="row.span.span_id"
              :row="row"
              :selected="row.span.span_id === selectedSpanId"
              :hovered="row.span.span_id === hoveredSpanId"
              :trace-start="traceBounds.traceStart"
              :trace-duration="traceBounds.traceDuration"
              @select-span="$emit('select-span', $event)"
              @hover="hoveredSpanId = $event"
              @unhover="hoveredSpanId = null"
            />
          </div>
          <p v-if="zoomHint" class="px-3 py-2 text-micro color-faint">
            Ctrl + scroll to zoom, drag to pan
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionButton from '@antfu/design/components/Action/ActionButton.vue'
import DisplayBadge from '@antfu/design/components/Display/DisplayBadge.vue'
import DisplayDuration from '@antfu/design/components/Display/DisplayDuration.vue'
import DisplayKeyValue from '@antfu/design/components/Display/DisplayKeyValue.vue'
import DisplayNumber from '@antfu/design/components/Display/DisplayNumber.vue'
import { SpanStatusCode } from '@opentelemetry/api'
import { computed, reactive, ref, watch } from 'vue'
import type { Span, Trace } from '~shared/types'
import { flattenVisibleTree, spanListToTree } from '../../../utils/span-tree.ts'
import { getTraceBounds } from '../../../utils/trace.ts'
import { useResizablePanel } from '../../../composables/useResizablePanel.ts'
import { useWaterfallZoom } from '../../../composables/useWaterfallZoom.ts'
import { useWaterfallPan } from '../../../composables/useWaterfallPan.ts'
import TraceTimeline from '~/components/trace/waterfall/TraceTimeline.vue'
import SpanRowName from '~/components/trace/waterfall/SpanRowName.vue'
import SpanRowBar from '~/components/trace/waterfall/SpanRowBar.vue'

const props = defineProps<{
  trace: Trace
  spans: Span[]
  selectedSpanId?: string | null
}>()

defineEmits<{
  'select-span': [span: Span]
}>()

const {
  width: nameColWidth,
  dragging: nameColDragging,
  onMouseDownLeft: onNameColMouseDown,
} = useResizablePanel('waterfall-name-col', 280, { min: 180, max: 560 })

const isError = computed(() => props.trace.status_code === SpanStatusCode.ERROR)
const errorCount = computed(() => props.spans.filter(s => s.status_code === SpanStatusCode.ERROR).length)

const statusColor = computed(() => {
  if (props.trace.status_code === SpanStatusCode.ERROR) return 'red'
  if (props.trace.status_code === SpanStatusCode.OK) return 'green'
  return 'amber'
})

const statusText = computed(() => {
  if (props.trace.status_code === SpanStatusCode.ERROR) return 'Error'
  if (props.trace.status_code === SpanStatusCode.OK) return 'Ok'
  return 'Unset'
})

const spanTree = computed(() => spanListToTree(props.spans))
const traceBounds = computed(() => getTraceBounds(props.spans))

const expandedState = reactive(new Map<string, boolean>())

function isExpanded(spanId: string): boolean {
  return expandedState.get(spanId) ?? true
}

function toggleShowChildren(spanId: string) {
  expandedState.set(spanId, !isExpanded(spanId))
}

function collectParentIds(): string[] {
  const ids: string[] = []
  const walk = (nodes: ReturnType<typeof spanListToTree>) => {
    for (const node of nodes) {
      if (node.children.length > 0) ids.push(node.span.span_id)
      if (node.children.length > 0) walk(node.children)
    }
  }
  walk(spanTree.value)
  return ids
}

function expandAll() {
  expandedState.clear()
}

function collapseAll() {
  for (const id of collectParentIds()) expandedState.set(id, false)
}

const flatRows = computed(() => flattenVisibleTree(spanTree.value, isExpanded))

const hoveredSpanId = ref<string | null>(null)

const leftPanel = ref<HTMLElement | null>(null)
const timelineContainer = ref<HTMLElement | null>(null)

const { zoomLevel, resetZoom, isZoomed } = useWaterfallZoom(timelineContainer)
const { isPanning, onMouseDown: onTimelineMouseDown } = useWaterfallPan(timelineContainer)

const zoomHint = computed(() => flatRows.value.length > 0 && !isZoomed.value)

const timelineContentStyle = computed(() => ({
  width: `${zoomLevel.value * 100}%`,
  minWidth: '100%',
}))

let syncingScroll = false

function syncScrollFromLeft(event: Event) {
  if (syncingScroll) return
  syncingScroll = true
  const source = event.target as HTMLElement
  if (timelineContainer.value) {
    timelineContainer.value.scrollTop = source.scrollTop
  }
  syncingScroll = false
}

function syncScrollFromRight(event: Event) {
  if (syncingScroll) return
  syncingScroll = true
  const source = event.target as HTMLElement
  if (leftPanel.value) {
    leftPanel.value.scrollTop = source.scrollTop
  }
  syncingScroll = false
}

watch(
  () => props.trace.trace_id,
  () => {
    resetZoom()
    expandedState.clear()
    hoveredSpanId.value = null
  },
)
</script>
