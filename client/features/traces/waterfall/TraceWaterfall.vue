<template>
  <div class="h-full min-h-0 flex flex-col bg-base">
    <header class="border-b border-base bg-secondary shrink-0">
      <div class="px-3 pt-2 pb-2">
        <div class="flex items-center justify-between gap-2 min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="size-1.5 rounded-full shrink-0"
              :class="isError ? 'bg-error' : 'bg-success'"
              :title="isError ? 'Error' : 'OK'"
            />
            <h2 class="text-sm color-base font-medium truncate" :title="trace.operation_name">
              {{ trace.operation_name }}
            </h2>
          </div>
          <Badge :color="statusColor" class="uppercase text-mini justify-self-center">
            {{ statusText }}
          </Badge>
        </div>

        <div class="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-mini">
          <KeyValue orientation="inline" label="Service">
            <span class="font-medium">{{ trace.service_name }}</span>
          </KeyValue>
          <KeyValue orientation="inline" label="Duration">
            <Duration :ms="trace.duration" />
          </KeyValue>
          <KeyValue orientation="inline" label="Spans">
            <Number :value="spans.length" />
          </KeyValue>
          <span v-if="errorCount > 0" class="color-scale-critical tabular-nums">
            <Number :value="errorCount" /> error{{ errorCount === 1 ? '' : 's' }}
          </span>
          <span class="ml-auto flex items-center gap-1.5">
            <Button
              variant="text"
              size="sm"
              :active="showHotPath"
              title="Highlight the spans that carried the trace's duration"
              @click="showHotPath = !showHotPath"
            >
              Hot path
            </Button>
            <Button variant="text" size="sm" @click="expandAll">
              Expand all
            </Button>
            <Button variant="text" size="sm" @click="collapseAll">
              Collapse all
            </Button>
            <Button v-if="isZoomed" variant="text" size="sm" @click="resetZoom">
              Reset zoom
            </Button>
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
        class="overflow-auto scrollbar-none shrink-0 bg-base"
        :style="{ width: `${nameColWidth}px` }"
        @scroll="syncScrollFromLeft"
      >
        <div class="sticky top-0 z-40 bg-base border-b border-base h-8 flex items-center px-3">
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
              :hot="hotPathIds.has(row.span.span_id)"
              :hot-path-enabled="showHotPath"
              :trace-start="traceBounds.traceStart"
              :trace-duration="traceBounds.traceDuration"
              @select-span="$emit('select-span', $event)"
              @hover="hoveredSpanId = $event"
              @unhover="hoveredSpanId = null"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SpanStatusCode } from '@opentelemetry/api'
import { computed, reactive, ref, watch } from 'vue'
import { useResizablePanel } from '~/composables/useResizablePanel'
import { useWaterfallPan } from '~/composables/useWaterfallPan'
import { useWaterfallZoom } from '~/composables/useWaterfallZoom'
import SpanRowBar from '~/features/traces/waterfall/SpanRowBar.vue'
import SpanRowName from '~/features/traces/waterfall/SpanRowName.vue'
import TraceTimeline from '~/features/traces/waterfall/TraceTimeline.vue'
import Badge from '~/ui/components/Badge.vue'
import Button from '~/ui/components/Button.vue'
import Duration from '~/ui/components/Duration.vue'
import KeyValue from '~/ui/components/KeyValue.vue'
import Number from '~/ui/components/Number.vue'
import { findHotPath } from '~/utils/hot-path'
import { flattenVisibleTree, spanListToTree } from '~/utils/span-tree'
import { getTraceBounds } from '~/utils/trace'
import type { Span, Trace } from '~shared/types'

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

/** Span ids on the hot path: every serial phase, plus the chain the trace finished on. */
const hotPathIds = computed(() => new Set(findHotPath(props.spans).map(span => span.span_id)))
/** Per-trace inspection mode: switching traces drops back to the plain waterfall. */
const showHotPath = ref(false)

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
    showHotPath.value = false
  },
)
</script>
