<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import ActionButton from '@antfu/design/components/Action/ActionButton.vue'
import DisplayNumberBadge from '@antfu/design/components/Display/DisplayNumberBadge.vue'
import FeedbackEmptyState from '@antfu/design/components/Feedback/FeedbackEmptyState.vue'
import LayoutToolbar from '@antfu/design/components/Layout/LayoutToolbar.vue'
import { useLogs } from '../composables/useLogs'
import LogRow from '~/components/log/LogRow.vue'

const { logs, clearAllLogs } = useLogs()
</script>

<template>
  <div class="h-full flex flex-col bg-base min-h-0">
    <LayoutToolbar>
      <template #start>
        <span class="text-sm color-base font-medium">Logs</span>
        <DisplayNumberBadge :value="logs.length" />
      </template>
      <template #end>
        <ActionButton size="sm" icon="i-ph:trash" @click="clearAllLogs">
          Clear
        </ActionButton>
      </template>
    </LayoutToolbar>

    <template v-if="logs.length">
      <div class="flex-1 overflow-y-auto relative min-h-0">
        <div
          class="sticky top-0 z-nav bg-base border-b border-base grid grid-cols-[64px_168px_140px_1fr_24px] items-center gap-3 px-3 py-1.5"
        >
          <span class="text-micro color-faint font-medium uppercase tracking-wide">Severity</span>
          <span class="text-micro color-faint font-medium uppercase tracking-wide">Timestamp</span>
          <span class="text-micro color-faint font-medium uppercase tracking-wide">Service</span>
          <span class="text-micro color-faint font-medium uppercase tracking-wide">Message</span>
          <span />
        </div>
        <div>
          <div v-for="log in logs" :key="log.log_id">
            <LogRow :log="log" />
          </div>
        </div>
      </div>
    </template>

    <FeedbackEmptyState
      v-else
      icon="i-ph:article-duotone"
      title="No logs yet"
    >
      <template #hint>
        Waiting for logs from instrumented applications
      </template>
    </FeedbackEmptyState>
  </div>
</template>
