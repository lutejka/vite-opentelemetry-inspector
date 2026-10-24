<!-- @description an action button — `variant` action/text, `size` sm/md, optional leading `icon`; `iconOnly` renders the icon-button recipe with `compact`, `active`, `label`. -->
<script setup lang="ts">
import { computed } from 'vue'

const {
  icon,
  variant = 'action',
  size = 'md',
  iconOnly,
  compact,
  active,
  label,
} = defineProps<{
  icon?: string
  variant?: 'action' | 'text'
  size?: 'sm' | 'md'
  /** Render the round icon-button recipe instead of the text-button recipes. */
  iconOnly?: boolean
  /** Compact, square (non-circular) icon button for dense toolbars. */
  compact?: boolean
  active?: boolean
  /** Accessible label when the button has no visible text. */
  label?: string
}>()

const sm = computed(() => size === 'sm')

// One recipe per variant, both sharing the same box (see the `btn-*` utilities
// in `styles/utilities.css`) so a mixed row of variants aligns. `size` only
// ever changes the type scale — never the padding.
const variantClass = computed(() => {
  if (variant === 'text') {
    return sm.value ? 'btn-text text-sm' : 'btn-text'
  }
  return sm.value ? 'btn-action-sm' : 'btn-action'
})

// No `size` prop for `iconOnly`: the button's own `font-size` is the size.
// Width/height come purely from the icon glyph (sized in `em` by the icon
// plugin) plus em-based padding, so a `text-sm`/`text-lg`/etc. class (or any
// font-size) resizes the whole button — same convention as Badge. `!`
// overrides the shared `btn-icon(-compact)` utility's fixed `w-*`/`h-*`.
const iconClass = computed(() => [
  compact ? 'btn-icon-compact' : 'btn-icon',
  compact ? 'w-auto! h-auto! p-[0.25em]' : 'w-auto! h-auto! p-[0.5em]',
  active ? 'color-active bg-active opacity-100' : '',
])
</script>

<template>
  <button
    type="button"
    :class="iconOnly ? iconClass : variantClass"
    :aria-label="label"
    :aria-pressed="active || undefined"
  >
    <span v-if="icon" :class="icon" aria-hidden="true" />
    <slot />
  </button>
</template>
