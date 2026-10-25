import { describe, expect, it, vi } from 'vitest'
import type { GaugeScaleSettingsStore } from './useMetricGaugeScales'
import { createGaugeScaleController } from './useMetricGaugeScales'

function createFakeStore(initial: Record<string, unknown> = {}) {
  let value = { ...initial }
  const listeners = new Set<(next: unknown) => void>()

  const store: GaugeScaleSettingsStore = {
    all: vi.fn(async () => value),
    set: vi.fn(async (_key, next) => {
      value = { ...value, gaugeScales: next }
      for (const listener of listeners) listener(value)
    }),
    onChange: vi.fn(async (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
  }

  return {
    store,
    get value() {
      return value
    },
    emit(next: Record<string, unknown>) {
      value = next
      for (const listener of listeners) listener(value)
    },
  }
}

describe('createGaugeScaleController', () => {
  it('loads sanitized overrides once and tracks remote changes', async () => {
    const fake = createFakeStore({
      gaugeScales: {
        good: { min: 0, max: 100 },
        bad: { min: 10, max: 1 },
      },
    })
    const controller = createGaugeScaleController(async () => fake.store)

    await controller.load()
    await controller.load()

    expect(controller.overrides.value).toEqual({ good: { min: 0, max: 100 } })
    expect(fake.store.all).toHaveBeenCalledTimes(1)

    fake.emit({ gaugeScales: { other: { min: -1, max: 1 } } })
    expect(controller.overrides.value).toEqual({ other: { min: -1, max: 1 } })
  })

  it('merges and persists a scale override', async () => {
    const fake = createFakeStore()
    const controller = createGaugeScaleController(async () => fake.store)

    await controller.setScale('heap', { min: 0, max: 100 })
    await controller.setScale('cpu', { min: -10, max: 10 })

    expect(controller.overrides.value).toEqual({
      heap: { min: 0, max: 100 },
      cpu: { min: -10, max: 10 },
    })
    expect(fake.value.gaugeScales).toEqual({
      heap: { min: 0, max: 100 },
      cpu: { min: -10, max: 10 },
    })
  })

  it('removes and persists a reset override', async () => {
    const fake = createFakeStore({ gaugeScales: { heap: { min: 0, max: 100 } } })
    const controller = createGaugeScaleController(async () => fake.store)
    await controller.load()

    await controller.resetScale('heap')

    expect(controller.overrides.value).toEqual({})
    expect(fake.value.gaugeScales).toEqual({})
  })

  it('keeps the in-memory override when persistence fails', async () => {
    const controller = createGaugeScaleController(async () => ({
      all: async () => ({}),
      set: async () => {
        throw new Error('no settings')
      },
      onChange: async () => () => {},
    }))

    await controller.setScale('heap', { min: 0, max: 100 })

    expect(controller.overrides.value).toEqual({ heap: { min: 0, max: 100 } })
  })
})
