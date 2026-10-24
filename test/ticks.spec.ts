import { describe, expect, it } from 'vitest'
import { getTimeTicks } from '../client/utils/ticks'

describe('getTimeTicks', () => {
  it('spans the whole trace at 1x zoom', () => {
    const ticks = getTimeTicks({ duration: 1000, contentWidth: 1000, viewportWidth: 1000, scrollLeft: 0 })

    expect(ticks[0]).toEqual({ time: 0, left: 0 })
    expect(ticks.at(-1)!.time).toBe(1000)
    expect(ticks).toHaveLength(11)
  })

  it('only returns ticks inside the visible window when scrolled', () => {
    const ticks = getTimeTicks({ duration: 1000, contentWidth: 8000, viewportWidth: 1000, scrollLeft: 3000 })

    expect(ticks.map(tick => tick.time)).toEqual([380, 400, 420, 440, 460, 480, 500])
    for (const tick of ticks) {
      expect(tick.left).toBeGreaterThanOrEqual(0)
      expect(tick.left).toBeLessThanOrEqual(1000)
    }
  })

  it('keeps ticks readable at high zoom', () => {
    const ticks = getTimeTicks({ duration: 1000, contentWidth: 64000, viewportWidth: 1000, scrollLeft: 0 })

    expect(ticks.length).toBeGreaterThan(2)
    expect(ticks.length).toBeLessThanOrEqual(40)
    expect(ticks.map(tick => tick.time)).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
    expect(ticks[1]!.left - ticks[0]!.left).toBe(128)
  })

  it('offsets ticks by the track inset', () => {
    const ticks = getTimeTicks({
      duration: 1000,
      contentWidth: 900,
      viewportWidth: 500,
      scrollLeft: 0,
      inset: 6,
    })

    expect(ticks[0]).toEqual({ time: 0, left: 6 })
    expect(ticks[1]).toEqual({ time: 100, left: 96 })
  })

  it('accounts for the inset when deciding what is visible', () => {
    const ticks = getTimeTicks({
      duration: 1000,
      contentWidth: 900,
      viewportWidth: 500,
      scrollLeft: 300,
      inset: 6,
    })

    // Track starts 6px into the timeline, so the visible slice begins at (300 - 6) / 0.9 = 326.7ms.
    expect(ticks[0]).toEqual({ time: 400, left: 66 })
  })

  it('returns no ticks for a zero duration', () => {
    expect(getTimeTicks({ duration: 0, contentWidth: 1000, viewportWidth: 1000, scrollLeft: 0 })).toEqual([])
  })

  it('returns no ticks when there is nothing to render into', () => {
    expect(getTimeTicks({ duration: 1000, contentWidth: 0, viewportWidth: 1000, scrollLeft: 0 })).toEqual([])
    expect(getTimeTicks({ duration: 1000, contentWidth: 1000, viewportWidth: 0, scrollLeft: 0 })).toEqual([])
  })
})
