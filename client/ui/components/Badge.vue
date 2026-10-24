<!-- @description a status/type/tag chip — hash-colored from `text`, a palette name (`color="green"`), a hue, or muted; sized by its own `font-size`. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useColorScheme } from '../composables/colorScheme'
import { getHashColorFromString, getHsla, withAlpha } from '../utils/color'

const {
  text,
  color = true,
  colorScheme,
} = defineProps<{
  /** Text content (also the hash seed when `color` is `true`). */
  text?: string
  /**
   * - `true` (default): deterministic color hashed from `text`
   * - `false`: neutral / muted
   * - `number`: explicit hue (0–360)
   * - `'#...'` / `'hsl(...)'` / `'rgb(...)'`: explicit CSS color
   * - any other string: a palette name → `badge-color-<name>`
   */
  color?: boolean | number | string
  /**
   * The app's current color scheme — tunes hash colors for contrast. Falls
   * back to {@link provideColorScheme} context, then `'light'`.
   */
  colorScheme?: 'light' | 'dark'
}>()

function isCssColor(value: string): boolean {
  return /^#|^hsl|^rgb|^var\(/.test(value)
}

const scheme = useColorScheme(() => colorScheme)
const dark = computed(() => scheme.value === 'dark')

const isPaletteColor = computed(() => typeof color === 'string' && !isCssColor(color))

const seedColor = computed<string | undefined>(() => {
  if (typeof color === 'number') {
    return getHsla(color, 1, dark.value)
  }
  if (typeof color === 'string' && isCssColor(color)) {
    return color
  }
  if (color === true && text) {
    return getHashColorFromString(text, 1, dark.value)
  }
  return undefined
})

const seedBg = computed<string | undefined>(() => {
  if (typeof color === 'number') {
    return getHsla(color, 0.12, dark.value)
  }
  if (typeof color === 'string' && isCssColor(color)) {
    return withAlpha(color, 0.12)
  }
  if (color === true && text) {
    return getHashColorFromString(text, 0.12, dark.value)
  }
  return undefined
})

const seedBorder = computed<string | undefined>(() => {
  if (typeof color === 'number') {
    return getHsla(color, 0.2, dark.value)
  }
  if (typeof color === 'string' && isCssColor(color)) {
    return withAlpha(color, 0.2)
  }
  if (color === true && text) {
    return getHashColorFromString(text, 0.2, dark.value)
  }
  return undefined
})

// Padding scales off whatever `font-size` is in effect on the badge itself —
// inherited from context by default, or set directly (e.g. a `text-sm`
// class) to resize the badge. No `size` prop: the font size *is* the size.
const style = computed(() => {
  const base = { padding: '0.25em 0.5em' }
  if (!seedColor.value) {
    return base
  }
  return !isPaletteColor.value
    ? { ...base, color: seedColor.value, background: seedBg.value, border: `1px solid ${seedBorder.value}` }
    : { ...base, color: seedColor.value, background: seedBg.value }
})

const paletteClass = computed(() =>
  isPaletteColor.value
    ? `badge-color-${color}`
    : color === false
    ? 'badge-muted'
    : ''
)
</script>

<template>
  <span
    class="leading-none font-medium inline-flex gap-1 items-center rounded-md"
    :class="paletteClass"
    :style="style"
  >
    <slot>{{ text }}</slot>
  </span>
</template>
