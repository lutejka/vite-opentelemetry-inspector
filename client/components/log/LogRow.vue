<template>
  <div>
    <div
      class="grid items-center gap-3 px-3 py-1.5 cursor-pointer transition hover:bg-hover border-b border-mute"
      :class="{
        'bg-active hover:bg-active': isExpanded,
        'grid-cols-[64px_168px_140px_1fr_24px]': showServiceColumn,
        'grid-cols-[64px_168px_1fr_24px]': !showServiceColumn,
      }"
      @click="toggle"
    >
      <DisplayBadge :color="severityColor" class="uppercase text-mini justify-self-center">
        {{ severityLabel }}
      </DisplayBadge>

      <DisplayDate :date="log.timestamp" class="text-mini color-faint font-mono whitespace-nowrap tabular-nums" />

      <span v-if="showServiceColumn" class="text-xs color-muted truncate">
        {{ log.service_name }}
      </span>

      <span class="text-xs color-base truncate">
        {{ log.body }}
      </span>

      <span
        class="i-ph:caret-down size-3.5 color-faint shrink-0 transition-transform duration-150"
        :class="{ 'rotate-180': isExpanded }"
        aria-hidden="true"
      />
    </div>

    <div v-if="isExpanded" class="border-b border-base bg-sunken">
      <div class="px-3 py-2.5 space-y-3">
        <div v-if="log.trace_id || log.span_id" class="flex flex-wrap gap-x-6 gap-y-2">
          <DisplayKeyValue v-if="log.trace_id" orientation="stacked" label="Trace ID">
            <span class="font-mono text-mini break-all">{{ log.trace_id }}</span>
          </DisplayKeyValue>
          <DisplayKeyValue v-if="log.span_id" orientation="stacked" label="Span ID">
            <span class="font-mono text-mini break-all">{{ log.span_id }}</span>
          </DisplayKeyValue>
          <DisplayKeyValue v-if="!showServiceColumn" orientation="stacked" label="Service">
            <span class="text-mini break-all">{{ log.service_name }}</span>
          </DisplayKeyValue>
        </div>

        <div v-if="hasAttributes">
          <h4 class="text-micro color-faint font-medium uppercase tracking-wide mb-1.5">Attributes</h4>
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
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import DisplayBadge from '@antfu/design/components/Display/DisplayBadge.vue'
import DisplayDate from '@antfu/design/components/Display/DisplayDate.vue'
import DisplayKeyValue from '@antfu/design/components/Display/DisplayKeyValue.vue'
import { computed, ref } from 'vue'
import type { Log } from '~shared/types'

const { log, showServiceColumn = true } = defineProps<{
  log: Log
  showServiceColumn?: boolean
}>()

const isExpanded = ref(false)

function toggle() {
  isExpanded.value = !isExpanded.value
}

const severityLabel = computed(() => {
  if (log.severity_text) return log.severity_text
  if (log.severity_number >= 21) return 'Fatal'
  if (log.severity_number >= 17) return 'Error'
  if (log.severity_number >= 13) return 'Warn'
  if (log.severity_number >= 9) return 'Info'
  if (log.severity_number >= 5) return 'Debug'
  if (log.severity_number >= 1) return 'Trace'
  return 'Unset'
})

const severityColor = computed(() => {
  if (log.severity_number >= 21 || log.severity_number >= 17) return 'red'
  if (log.severity_number >= 13) return 'amber'
  if (log.severity_number >= 9) return 'blue'
  if (log.severity_number >= 5) return 'violet'
  return false
})

const hasAttributes = computed(() => Object.keys(log.attributes).length > 0)
const attributeEntries = computed(() => Object.entries(log.attributes))

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Expose the root element for height measurement by parent
const rootEl = ref<HTMLElement | null>(null)
defineExpose({ rootEl })
</script>
