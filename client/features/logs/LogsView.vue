<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useLogs } from '~/composables/useLogs'
import Button from '~/ui/components/Button.vue'
import EmptyState from '~/ui/components/EmptyState.vue'
import NumberBadge from '~/ui/components/NumberBadge.vue'
import Toolbar from '~/ui/components/Toolbar.vue'
import LogRow from './LogRow.vue'

const { logs, clearAllLogs } = useLogs()
</script>

<template>
  <div class="h-full flex flex-col bg-base min-h-0">
    <Toolbar>
      <template #start>
        <span class="text-sm color-base font-medium">Logs</span>
        <NumberBadge :value="logs.length" />
      </template>
      <template #end>
        <Button size="sm" icon="icon-[ph--trash]" @click="clearAllLogs">
          Clear
        </Button>
      </template>
    </Toolbar>

    <template v-if="logs.length">
      <div class="flex-1 overflow-y-auto relative min-h-0">
        <div class="sticky top-0 z-nav bg-base border-b border-base grid grid-cols-[64px_168px_140px_1fr_24px] items-center gap-3 px-3 py-1.5">
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

    <EmptyState
      v-else
      icon="icon-[ph--article-duotone]"
      title="No logs yet"
    >
      <template #hint>
        Waiting for logs from instrumented applications
      </template>
    </EmptyState>
  </div>
</template>
