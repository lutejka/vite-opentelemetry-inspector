import { SpanStatusCode } from '@opentelemetry/api'

/** Semantic color for failed spans. */
export const ERROR_BAR_COLOR = 'var(--ui-red)'

/** Dracula purple (#bd93f9) in OKLCH, so level 0 sits on the theme accent. */
const BASE_HUE = 302
/** Golden angle: each level lands in the largest remaining gap on the hue wheel. */
const GOLDEN_ANGLE = 137.508
/**
 * After each band of eight hue steps, drop one tone so the hue walk's
 * near-repeats (around levels 8, 13 and 21) stay distinguishable.
 */
const TONE_BAND = 8
const DARK_TONES = [0.74, 0.70, 0.66, 0.62]
const LIGHT_TONES = [0.50, 0.46, 0.42, 0.38]
const DARK_CHROMA = 0.125
const LIGHT_CHROMA = 0.12

/**
 * Map a span-tree depth to a theme-matched OKLCH color.
 *
 * The hue rotates by the golden angle from the Dracula purple accent, while
 * OKLCH keeps perceived lightness predictable: every band clears the 3:1
 * non-text contrast threshold against the dark (#282a36) and light (#fffbeb)
 * surfaces. Deeper bands step down in lightness so the hue walk's near-repeats
 * (around levels 8, 13 and 21) remain distinguishable.
 *
 * @param level - The depth in the span tree (0 = root).
 * @param dark - Whether to use the dark-theme tone ladder. Defaults to `true`.
 * @returns A CSS `oklch()` color string.
 */
export function getDepthColor(level: number, dark = true): string {
  const depth = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0
  const hue = (BASE_HUE + depth * GOLDEN_ANGLE) % 360
  const tones = dark ? DARK_TONES : LIGHT_TONES
  const lightness = tones[Math.floor(depth / TONE_BAND) % tones.length]
  const chroma = dark ? DARK_CHROMA : LIGHT_CHROMA
  const hueText = Number(hue.toFixed(3))
  return `oklch(${lightness} ${chroma} ${hueText})`
}

/**
 * Bar color for a span: failures keep the semantic error color, everything
 * else uses the depth ramp.
 */
export function getDepthBarColor(depth: number, statusCode: number, dark = true): string {
  if (statusCode === SpanStatusCode.ERROR) {
    return ERROR_BAR_COLOR
  }
  return getDepthColor(depth, dark)
}
