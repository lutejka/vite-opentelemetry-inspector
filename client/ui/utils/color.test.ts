import { describe, expect, it } from 'vitest'
import { getHashColorFromString, getHsla, withAlpha } from './color'

function hueOf(color: string): number {
  const match = color.match(/^hsla\((-?\d+(?:\.\d+)?),/)
  if (!match) {
    throw new Error(`Not an hsla() color: ${color}`)
  }
  return Number(match[1])
}

describe('getHsla', () => {
  it('uses the light-mode saturation and lightness by default', () => {
    expect(getHsla(180)).toBe('hsla(180, 65%, 40%, 1)')
    expect(getHsla(180, 0.5)).toBe('hsla(180, 65%, 40%, 0.5)')
  })

  it('uses the dark-mode saturation and lightness when asked', () => {
    expect(getHsla(180, 1, true)).toBe('hsla(180, 50%, 60%, 1)')
    expect(getHsla(0, '0.4', true)).toBe('hsla(0, 50%, 60%, 0.4)')
  })
})

describe('getHashColorFromString', () => {
  it('is deterministic for the same string', () => {
    expect(getHashColorFromString('Vite')).toBe(getHashColorFromString('Vite'))
    expect(getHashColorFromString('Vite', 0.5, true)).toBe(getHashColorFromString('Vite', 0.5, true))
  })

  it('maps different strings to different hues', () => {
    expect(hueOf(getHashColorFromString('Vite'))).not.toBe(hueOf(getHashColorFromString('DevTools')))
    expect(hueOf(getHashColorFromString('plugin-a'))).not.toBe(hueOf(getHashColorFromString('plugin-b')))
  })

  it('always produces a hue in the 0–360 range', () => {
    for (const name of ['', 'a', 'Vite', 'a-very-long-package-name', 'Ω']) {
      const hue = hueOf(getHashColorFromString(name))
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('passes opacity and dark mode through to the hsla string', () => {
    expect(getHashColorFromString('Vite', 0.25, true)).toMatch(/, 50%, 60%, 0\.25\)$/)
  })
})

describe('withAlpha', () => {
  it('returns legacy comma-syntax rgba()', () => {
    expect(withAlpha('#336699', 0.5)).toBe('rgba(51, 102, 153, 0.5)')
    expect(withAlpha('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)')
  })

  it('accepts any CSS color string and clamps the channels', () => {
    expect(withAlpha('hsl(0, 100%, 50%)', 0.2)).toBe('rgba(255, 0, 0, 0.2)')
    expect(withAlpha('white', 0)).toBe('rgba(255, 255, 255, 0)')
  })
})
