<script setup lang="ts">
import ActionIconButton from '@antfu/design/components/Action/ActionIconButton.vue'
import OverlayTooltip from '@antfu/design/components/Overlay/OverlayTooltip.vue'
import { provideColorScheme } from '@antfu/design/composables/colorScheme'
import { onMounted, onUnmounted, ref } from 'vue'
import TracesView from './pages/TracesView.vue'
import LogsView from './pages/LogsView.vue'
import { useOtelStore } from './otel'
import { useColorMode } from './composables/useColorMode.ts'

const tab = ref<string>('traces')
const { connect, disconnect } = useOtelStore()

const tabs = [
  { id: 'traces', label: 'Traces', icon: 'i-ph:tree-structure-duotone' },
  { id: 'logs', label: 'Logs', icon: 'i-ph:article-duotone' },
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
      <OverlayTooltip
        v-for="t in tabs"
        :key="t.id"
        :content="t.label"
        placement="right"
      >
        <ActionIconButton
          :icon="t.icon"
          :label="t.label"
          :active="tab === t.id"
          class="text-lg"
          @click="tab = t.id"
        />
      </OverlayTooltip>
    </nav>
    <div class="flex-1 min-w-0 flex flex-col min-h-0">
      <TracesView v-if="tab === 'traces'" />
      <LogsView v-else />
    </div>
  </div>
</template>
