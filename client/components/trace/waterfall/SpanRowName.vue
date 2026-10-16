<template>
  <div
    class="relative flex items-center gap-1.5 min-w-0 h-7 pr-1.5 rounded-l-md cursor-pointer transition-colors"
    :class="selected ? 'bg-active' : hovered ? 'bg-hover' : 'hover:bg-hover'"
    :style="{ paddingLeft: `${8 + row.depth * INDENT}px` }"
    @click="$emit('select-span', row.span)"
    @mouseenter="$emit('hover', row.span.span_id)"
    @mouseleave="$emit('unhover')"
  >
    <span
      v-for="a in row.depth"
      :key="a"
      class="pointer-events-none absolute top-0 bottom-0 border-l border-base"
      :style="{ left: `${8 + (a - 1) * INDENT + CONNECTOR_X}px` }"
      aria-hidden="true"
    />
    <!-- Own column: always connected upward; continues down into children or
      following siblings, otherwise only the top half (elbow into this row). -->
    <template v-if="row.depth > 0">
      <span
        class="pointer-events-none absolute border-l border-base"
        :style="{
          left: `${8 + row.depth * INDENT + CONNECTOR_X}px`,
          top: '0px',
          height: continuesDown ? '100%' : '50%',
        }"
        aria-hidden="true"
      />
    </template>

    <OverlayTooltip
      v-if="row.hasChildren"
      :content="expanded ? 'Collapse' : `Expand (${row.childCount})`"
      placement="right"
      class="relative z-nav shrink-0 flex"
    >
      <ActionIconButton
        compact
        class="text-sm bg-base"
        :label="expanded ? 'Collapse' : 'Expand'"
        @click.stop="$emit('toggle', row.span.span_id)"
      >
        <span
          class="i-ph:caret-down transition-transform duration-150"
          :class="{ '-rotate-90': !expanded }"
          aria-hidden="true"
        />
      </ActionIconButton>
    </OverlayTooltip>
    <span v-else class="relative z-nav w-5 shrink-0 flex items-center justify-center" aria-hidden="true">
      <span class="size-1 rounded-full bg-current op-mute" />
    </span>

    <DisplayNumberBadge
      v-if="!expanded && row.hasChildren"
      :value="row.childCount"
      class="relative z-nav shrink-0"
      :title="`${row.childCount} hidden spans`"
    />

    <DisplayBadge
      :color="kindColor"
      class="relative z-nav shrink-0 uppercase text-mini justify-self-center size-5"
      :title="getSpanKindLabel(row.span.kind)"
    >
      {{ getSpanKindLabel(row.span.kind)[0] }}
    </DisplayBadge>
    <span
      v-if="isError"
      class="i-ph:x-circle relative z-nav shrink-0 color-scale-critical"
      title="Error span"
      aria-hidden="true"
    />
    <span class="relative z-nav text-xs color-base truncate min-w-0 flex-1" :title="row.span.name">
      {{ row.span.name }}
    </span>
    <DisplayDuration :ms="row.span.duration" class="relative z-nav text-mini color-faint shrink-0 ml-auto pl-2" />
  </div>
</template>

<script setup lang="ts">
import ActionIconButton from '@antfu/design/components/Action/ActionIconButton.vue'
import OverlayTooltip from '@antfu/design/components/Overlay/OverlayTooltip.vue'
import DisplayBadge from '@antfu/design/components/Display/DisplayBadge.vue'
import DisplayDuration from '@antfu/design/components/Display/DisplayDuration.vue'
import DisplayNumberBadge from '@antfu/design/components/Display/DisplayNumberBadge.vue'
import { computed } from 'vue'
import type { FlatSpanRow } from '../../../utils/span-tree'
import { getSpanKindLabel } from '../../../utils/formatters'

const INDENT = 16
const CONNECTOR_X = 10

const props = defineProps<{
  row: FlatSpanRow
  expanded: boolean
  selected: boolean
  hovered: boolean
}>()

defineEmits<{
  'select-span': [span: FlatSpanRow['span']]
  toggle: [spanId: string]
  hover: [spanId: string]
  unhover: []
}>()

const isError = computed(() => props.row.span.status_code === 2)

// The own-column line continues down into visible children or following
// siblings; otherwise this row is an elbow (top half only).
const continuesDown = computed(() =>
  props.row.hasNextSibling || (props.row.hasChildren && props.expanded),
)

// Literal palette names (kept literal for UnoCSS extraction, see uno.config
// safelist): blue = server, violet = client, emerald = producer.
const kindColor = computed(() => {
  switch (props.row.span.kind) {
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
</script>
