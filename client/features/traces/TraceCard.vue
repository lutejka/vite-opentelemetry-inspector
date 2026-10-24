<template>
  <div
    class="group relative bg-base border-b border-mute cursor-pointer transition hover:bg-hover"
    :class="{ 'bg-active hover:bg-active': isSelected }"
    @click="$emit('select', trace.trace_id)"
  >
    <span
      v-if="isSelected"
      class="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
      aria-hidden="true"
    />
    <div class="px-3 py-2 flex gap-2.5">
      <span
        class="mt-1.5 size-1.5 rounded-full shrink-0"
        :class="isError ? 'bg-error' : 'bg-success'"
        :title="isError ? 'Error' : 'OK'"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-medium color-base text-compact truncate">
            {{ trace.operation_name }}
          </h3>
          <Badge :color="statusColor" class="text-micro">
            {{ statusText }}
          </Badge>
        </div>
        <div class="mt-0.5 flex items-center justify-between gap-2 text-xs">
          <span class="color-muted truncate min-w-0">
            {{ trace.service_name }}
            <span class="color-faint font-mono ml-1.5">{{ shortTraceId }}</span>
          </span>
          <Duration :ms="trace.duration" class="shrink-0 text-mini" />
        </div>

        <div
          v-if="isError && trace.status_message"
          class="mt-1.5 text-mini color-scale-critical truncate"
          :title="trace.status_message"
        >
          {{ trace.status_message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SpanStatusCode } from '@opentelemetry/api'
import { computed } from 'vue'
import Badge from '~/ui/components/Badge.vue'
import Duration from '~/ui/components/Duration.vue'
import type { Trace } from '~shared/types'

const props = defineProps<{
  trace: Trace
  isSelected: boolean
}>()

defineEmits<{
  select: [traceId: string]
}>()

const isError = computed(() => props.trace.status_code === SpanStatusCode.ERROR)
const shortTraceId = computed(() => props.trace.trace_id?.slice(0, 8) ?? '')

const statusColor = computed(() => {
  if (props.trace.status_code === SpanStatusCode.ERROR) return 'red'
  if (props.trace.status_code === SpanStatusCode.OK) return 'green'
  return false
})

const statusText = computed(() => {
  if (props.trace.status_code === SpanStatusCode.ERROR) return 'Error'
  if (props.trace.status_code === SpanStatusCode.OK) return 'Ok'
  return 'Unset'
})
</script>
