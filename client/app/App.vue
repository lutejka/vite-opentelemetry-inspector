<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import LogsView from '~/features/logs/LogsView.vue'
import TracesView from '~/features/traces/TracesView.vue'
import Button from '~/ui/components/Button.vue'
import Tooltip from '~/ui/components/Tooltip.vue'
import { provideColorScheme } from '~/ui/composables/colorScheme'
import { useColorMode } from '../composables/useColorMode.ts'
import { useOtelStore } from './otel'

const tab = ref<string>('traces')
const { connect, disconnect } = useOtelStore()

const tabs = [
  { id: 'traces', label: 'Traces', icon: 'icon-[ph--tree-structure-duotone]' },
  { id: 'logs', label: 'Logs', icon: 'icon-[ph--article-duotone]' },
] as const

const { isDark } = useColorMode()

provideColorScheme(() => (isDark.value ? 'dark' : 'light'))

onMounted(() => {
  void connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="h-screen flex bg-base color-base">
    <nav class="flex flex-col items-center gap-1 shrink-0 border-r border-base py-2 w-13" aria-label="Views">
      <Tooltip
        v-for="t in tabs"
        :key="t.id"
        :content="t.label"
        placement="right"
      >
        <Button
          icon-only
          :icon="t.icon"
          :label="t.label"
          :active="tab === t.id"
          class="text-lg"
          @click="tab = t.id"
        />
      </Tooltip>
    </nav>
    <div class="flex-1 min-w-0 flex flex-col min-h-0">
      <TracesView v-if="tab === 'traces'" />
      <LogsView v-else />
    </div>
  </div>
</template>
