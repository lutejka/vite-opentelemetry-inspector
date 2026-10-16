<template>
  <div class="h-full flex flex-col bg-base min-h-0">
    <div class="flex items-center justify-between pl-3 pr-1.5 py-1.5 border-b border-base shrink-0 sticky top-0 bg-base z-nav">
      <h3 class="text-sm color-base font-medium">Span Details</h3>
      <OverlayTooltip content="Close span details" placement="left">
        <ActionIconButton compact icon="i-ph:x" label="Close span details" @click="$emit('close')" />
      </OverlayTooltip>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-xs min-h-0">
      <DisplayKeyValue orientation="stacked" label="Name">
        <span class="font-mono break-all text-xs">{{ span.name }}</span>
      </DisplayKeyValue>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="rounded-md border border-base bg-sunken px-2.5 py-2">
          <h4 class="text-micro color-faint font-medium uppercase tracking-wide mb-1">Kind</h4>
          <DisplayBadge :color="kindColor" class="uppercase">
            {{ getSpanKindLabel(span.kind) }}
          </DisplayBadge>
        </div>
        <div class="rounded-md border border-base bg-sunken px-2.5 py-2">
          <h4 class="text-micro color-faint font-medium uppercase tracking-wide mb-1">Status</h4>
          <DisplayBadge :color="statusColor" class="uppercase">
            {{ statusLabel }}
          </DisplayBadge>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <DisplayKeyValue orientation="stacked" label="Duration">
          <DisplayDuration :ms="span.duration" class="text-xs" />
        </DisplayKeyValue>
        <DisplayKeyValue orientation="stacked" label="Span ID">
          <span class="font-mono text-mini break-all">{{ span.span_id }}</span>
        </DisplayKeyValue>
      </div>

      <DisplayKeyValue orientation="stacked" label="Parent Span ID">
        <span class="font-mono text-mini break-all">{{ span.parent_span_id || '(root)' }}</span>
      </DisplayKeyValue>

      <div v-if="span.status_message">
        <h4 class="text-micro color-faint font-medium uppercase tracking-wide mb-1">Status Message</h4>
        <p class="text-mini color-scale-critical">
          {{ span.status_message }}
        </p>
      </div>

      <div v-if="hasAttributes">
        <h4 class="text-micro color-faint font-medium uppercase tracking-wide mb-1.5">
          Attributes ({{ attributeCount }})
        </h4>
        <div class="rounded-md border border-mute overflow-hidden">
          <DisplayKeyValue
            v-for="[key, value] in attributeEntries"
            :key="key"
            :label="key"
            class="px-2.5 py-1.5 border-b border-mute last:border-0"
          >
            <span class="break-all text-right">{{ formatValue(value) }}</span>
          </DisplayKeyValue>
        </div>
      </div>

      <div v-if="span.events.length > 0">
        <h4 class="text-micro color-faint font-medium uppercase tracking-wide mb-1.5">
          Events ({{ span.events.length }})
        </h4>
        <div class="space-y-1.5">
          <div v-for="(event, idx) in span.events" :key="idx" class="rounded-md border border-base bg-sunken px-2.5 py-2">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="color-base font-medium text-mini truncate">{{ event.name }}</span>
              <DisplayDuration :ms="event.time - span.start_time" class="text-micro color-faint shrink-0" />
            </div>
            <div class="rounded-md border border-mute overflow-hidden">
              <DisplayKeyValue
                v-for="[key, value] in Object.entries(event.attributes)"
                :key="key"
                :label="key"
                class="px-2.5 py-1.5 border-b border-mute last:border-0"
              >
                <span class="break-all text-right">{{ formatValue(value) }}</span>
              </DisplayKeyValue>
            </div>
          </div>
        </div>
      </div>

      <div v-if="logs.length">
        <h4 class="text-micro color-faint font-medium uppercase tracking-wide mb-1.5">Logs ({{ logs.length }})</h4>
        <div class="overflow-hidden rounded-md border border-mute">
          <LogRow v-for="logEntry in logs" :key="logEntry.log_id" :log="logEntry" :show-service-column="false" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionIconButton from '@antfu/design/components/Action/ActionIconButton.vue'
import OverlayTooltip from '@antfu/design/components/Overlay/OverlayTooltip.vue'
import DisplayBadge from '@antfu/design/components/Display/DisplayBadge.vue'
import DisplayDuration from '@antfu/design/components/Display/DisplayDuration.vue'
import DisplayKeyValue from '@antfu/design/components/Display/DisplayKeyValue.vue'
import { SpanStatusCode } from '@opentelemetry/api'
import { computed } from 'vue'
import type { Log, Span } from '~shared/types'
import { getSpanKindLabel } from '../utils/formatters'
import { useLogs } from '../composables/useLogs'
import LogRow from '~/components/log/LogRow.vue'

const props = defineProps<{
  span: Span
}>()

defineEmits<{
  close: []
}>()

const statusLabel = computed(() => {
  switch (props.span.status_code) {
    case SpanStatusCode.ERROR:
      return 'Error'
    case SpanStatusCode.OK:
      return 'Ok'
    default:
      return 'Unset'
  }
})

const statusColor = computed(() => {
  switch (props.span.status_code) {
    case SpanStatusCode.ERROR:
      return 'red'
    case SpanStatusCode.OK:
      return 'green'
    default:
      return 'amber'
  }
})

const kindColor = computed(() => {
  switch (props.span.kind) {
    case 1:
      return 'blue'
    case 2:
      return 'violet'
    case 3:
      return 'emerald'
    default:
      return false
  }
})

const hasAttributes = computed(() => Object.keys(props.span.attributes).length > 0)
const attributeCount = computed(() => Object.keys(props.span.attributes).length)
const attributeEntries = computed(() => Object.entries(props.span.attributes))

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const { logs: allLogs } = useLogs()
const logs = computed<Log[]>(() => {
  return allLogs.value.filter(
    logEntry => logEntry.trace_id === props.span.trace_id && logEntry.span_id === props.span.span_id,
  )
})
</script>
