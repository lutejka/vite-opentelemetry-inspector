import { computed, onScopeDispose, ref, watch } from 'vue'

/**
 * Follows the devframe hub color mode (`packages/hub-ui/.../state/color-mode`):
 * the hub persists an Auto / Light / Dark choice under
 * `devframes-color-scheme` (default Auto = follow the OS). Same-origin panels
 * receive updates via `storage` events, so one switch drives the shell and
 * every inner panel at once. Cross-origin panels cannot see the hub's key and
 * fall back to the OS preference, which matches the hub's Auto behavior.
 *
 * The resolved mode is applied as the `.dark` / `.light` class plus the native
 * `color-scheme` on `<html>`, mirroring the hub's `ColorSchemeRoot`.
 */
export type ColorSchemePreference = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'devframes-color-scheme'

function readPreference(): ColorSchemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored
    }
  } catch {
    // Storage unavailable (e.g. sandboxed frame) — fall through to Auto.
  }
  return 'auto'
}

const preference = ref<ColorSchemePreference>(readPreference())
const osDark = ref(
  typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches,
)

const isColorModeDark = computed(() => preference.value === 'auto' ? osDark.value : preference.value === 'dark')

function applyToDocument(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.classList.toggle('light', !dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

let listenersAttached = false

function attachListeners() {
  if (listenersAttached || typeof window === 'undefined') {
    return
  }
  listenersAttached = true

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) {
      return
    }
    preference.value = readPreference()
  })

  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onMediaChange = (event: MediaQueryListEvent) => {
    osDark.value = event.matches
  }
  if (typeof media?.addEventListener === 'function') {
    media.addEventListener('change', onMediaChange)
  } else if (typeof media?.addListener === 'function') {
    media.addListener(onMediaChange)
  }
}

/**
 * Start following the hub color mode. Applies the resolved mode immediately
 * and keeps it in sync while the caller's effect scope lives. Idempotent.
 */
export function useColorMode() {
  attachListeners()
  applyToDocument(isColorModeDark.value)

  const stop = watch(isColorModeDark, dark => applyToDocument(dark))
  onScopeDispose(stop)

  return { isDark: isColorModeDark, preference }
}
