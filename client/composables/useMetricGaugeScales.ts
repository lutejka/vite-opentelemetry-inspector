import type { Ref } from 'vue'
import { ref } from 'vue'
import type { GaugeScale } from '../utils/gauge'
import { sanitizeGaugeScales } from '../utils/gauge'

const NAMESPACE = 'opentelemetry'
const SETTINGS_KEY = 'gaugeScales'

/** The subset of devframe's project settings store this composable needs. */
export interface GaugeScaleSettingsStore {
  all: () => Promise<unknown>
  set: (key: typeof SETTINGS_KEY, value: Record<string, GaugeScale>) => Promise<void>
  onChange: (listener: (value: unknown) => void) => Promise<() => void>
}

export interface GaugeScaleController {
  overrides: Ref<Record<string, GaugeScale>>
  load: () => Promise<void>
  setScale: (name: string, scale: GaugeScale) => Promise<void>
  resetScale: (name: string) => Promise<void>
}

/**
 * Load, merge and persist per-metric gauge scales. Kept separate from the
 * devframe client so the merge and persistence rules are unit-testable.
 */
export function createGaugeScaleController(
  getStore: () => Promise<GaugeScaleSettingsStore>,
): GaugeScaleController {
  const overrides = ref<Record<string, GaugeScale>>({})
  let loaded = false
  let loading: Promise<void> | undefined

  async function load(): Promise<void> {
    if (loaded) return
    if (loading) return loading

    loading = (async () => {
      try {
        const store = await getStore()
        overrides.value = scalesFromSettings(await store.all())
        await store.onChange((value) => {
          overrides.value = scalesFromSettings(value)
        })
      } catch {
        // Settings are optional; keep working with in-memory overrides.
      } finally {
        loaded = true
        loading = undefined
      }
    })()
    return loading
  }

  async function persist(): Promise<void> {
    try {
      const store = await getStore()
      await store.set(SETTINGS_KEY, { ...overrides.value })
    } catch {
      // Settings are optional; the current session keeps the override.
    }
  }

  async function setScale(name: string, scale: GaugeScale): Promise<void> {
    await load()
    overrides.value = { ...overrides.value, [name]: { ...scale } }
    await persist()
  }

  async function resetScale(name: string): Promise<void> {
    await load()
    const { [name]: _removed, ...rest } = overrides.value
    overrides.value = rest
    await persist()
  }

  return { overrides, load, setScale, resetScale }
}

function scalesFromSettings(value: unknown): Record<string, GaugeScale> {
  if (!value || typeof value !== 'object') return {}
  return sanitizeGaugeScales((value as { gaugeScales?: unknown }).gaugeScales)
}

async function getProjectSettings(): Promise<GaugeScaleSettingsStore> {
  const { connectDevframe } = await import('devframe/client')
  const scoped = (await connectDevframe()).scope(NAMESPACE)
  return scoped.settings.project as unknown as GaugeScaleSettingsStore
}

let controller: GaugeScaleController | undefined

export function useMetricGaugeScales(): GaugeScaleController {
  controller ??= createGaugeScaleController(getProjectSettings)
  void controller.load()
  return controller
}

/** Test/HMR helper: drop the shared controller and its loaded settings. */
export function resetMetricGaugeScales(): void {
  controller = undefined
}
