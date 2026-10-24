import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'
import { ERROR_BAR_COLOR, getDepthBarColor, getDepthColor } from './span-colors'

function parseOklch(color: string) {
  const match = color.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/)
  if (!match) {
    throw new Error(`Not an oklch() color: ${color}`)
  }
  return {
    lightness: Number(match[1]),
    chroma: Number(match[2]),
    hue: Number(match[3]),
  }
}

describe('getDepthColor', () => {
  it('anchors level 0 on the Dracula purple hue', () => {
    const { lightness, chroma, hue } = parseOklch(getDepthColor(0))
    expect(lightness).toBe(0.74)
    expect(chroma).toBe(0.125)
    expect(hue).toBeCloseTo(302, 1)
  })

  it('advances the hue by the golden angle', () => {
    const first = parseOklch(getDepthColor(0)).hue
    const second = parseOklch(getDepthColor(1)).hue
    expect((second - first + 360) % 360).toBeCloseTo(137.508, 2)
  })

  it('drops one tone every eight levels', () => {
    expect(parseOklch(getDepthColor(0)).lightness).toBe(0.74)
    expect(parseOklch(getDepthColor(8)).lightness).toBe(0.70)
    expect(parseOklch(getDepthColor(16)).lightness).toBe(0.66)
    expect(parseOklch(getDepthColor(24)).lightness).toBe(0.62)
    expect(parseOklch(getDepthColor(32)).lightness).toBe(0.74)
  })

  it('uses darker tones for the light theme', () => {
    const { lightness, chroma } = parseOklch(getDepthColor(0, false))
    expect(lightness).toBe(0.50)
    expect(chroma).toBe(0.12)
  })

  it('clamps negative and non-finite levels to zero', () => {
    expect(getDepthColor(-2)).toBe(getDepthColor(0))
    expect(getDepthColor(Number.NaN)).toBe(getDepthColor(0))
    expect(getDepthColor(Number.POSITIVE_INFINITY)).toBe(getDepthColor(0))
  })

  it('gives every realistic level its own color', () => {
    const colors = new Set(Array.from({ length: 24 }, (_, level) => getDepthColor(level)))
    expect(colors.size).toBe(24)
  })

  it('keeps every level above 3:1 against the theme surfaces', () => {
    const surfaces = { dark: '#282a36', light: '#fffbeb' }
    for (const [mode, background] of Object.entries(surfaces)) {
      const dark = mode === 'dark'
      const surface = new Color(background)
      for (let level = 0; level < 32; level++) {
        const color = new Color(getDepthColor(level, dark))
        expect(color.contrastWCAG21(surface)).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe('getDepthBarColor', () => {
  it('keeps error spans on the semantic error color at every depth', () => {
    for (const depth of [0, 3, 8, 16, 31]) {
      expect(getDepthBarColor(depth, 2)).toBe(ERROR_BAR_COLOR)
      expect(getDepthBarColor(depth, 2, false)).toBe(ERROR_BAR_COLOR)
    }
  })

  it('uses the depth ramp for non-error spans', () => {
    expect(getDepthBarColor(3, 0)).toBe(getDepthColor(3))
    expect(getDepthBarColor(3, 1, false)).toBe(getDepthColor(3, false))
  })
})
