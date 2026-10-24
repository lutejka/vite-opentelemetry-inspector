/**
 * Deterministic string → HSL color utilities.
 *
 * Hue-based so the same string always maps to the same hue, with saturation /
 * lightness chosen to "adapt better contrast in light/dark mode" (the note from
 * config-inspector's color composable). Pure and framework-agnostic — the
 * dark-mode flag is an explicit argument so these stay unit-testable without a
 * DOM. Vue callers pass the scheme flag (e.g. `colorScheme === 'dark'`).
 *
 * Alpha application is delegated to colorjs.io.
 */
import Color from 'colorjs.io'

/**
 * Build an `hsla()` string for a given hue, dark-aware.
 *
 * Saturation and lightness are chosen per scheme (65%/40% in light mode, 50%/60%
 * in dark) so the resulting color keeps reasonable contrast against the page.
 *
 * @param hue - The hue in degrees (0–360).
 * @param opacity - The alpha channel, a number or CSS string. Defaults to `1`.
 * @param dark - Whether to use the dark-mode saturation/lightness. Defaults to `false`.
 * @returns An `hsla(...)` CSS color string.
 *
 * @example
 * getHsla(180) // → 'hsla(180, 65%, 40%, 1)'
 * getHsla(180, 0.5) // → 'hsla(180, 65%, 40%, 0.5)'
 * getHsla(180, 1, true) // → 'hsla(180, 50%, 60%, 1)'
 */
export function getHsla(
  hue: number,
  opacity: number | string = 1,
  dark = false,
): string {
  const saturation = dark ? 50 : 65
  const lightness = dark ? 60 : 40
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`
}

/**
 * Map an arbitrary string to a stable hue and return an `hsla()` color.
 *
 * Uses a deterministic string hash folded into the 0–360 hue range, so the same
 * input always yields the same color across runs and machines.
 *
 * @param name - The string to derive a hue from.
 * @param opacity - The alpha channel, a number or CSS string. Defaults to `1`.
 * @param dark - Whether to use the dark-mode saturation/lightness. Defaults to `false`.
 * @returns A deterministic `hsla(...)` CSS color string for the input.
 *
 * @example
 * getHashColorFromString('Vite') === getHashColorFromString('Vite') // → true (deterministic)
 * getHashColorFromString('Vite') !== getHashColorFromString('DevTools') // → true
 */
export function getHashColorFromString(
  name: string,
  opacity: number | string = 1,
  dark = false,
): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = ((hash % 360) + 360) % 360
  return getHsla(h, opacity, dark)
}

// ── Color math (colorjs.io) ───────────────────────────────────────────────

/**
 * Set a color's alpha channel, returning a legacy comma-syntax `rgba(...)`
 * string — deliberately not colorjs.io's default space/slash `rgb(... / a)`
 * syntax, which some CSS parsers (e.g. happy-dom, used in this repo's tests)
 * don't recognize.
 *
 * @param input - The base color as any CSS color string.
 * @param alpha - The alpha channel, 0–1.
 * @returns The color with the given alpha, as an `rgba(...)` string.
 *
 * @example
 * withAlpha('#336699', 0.5) // → 'rgba(51, 102, 153, 0.5)'
 */
export function withAlpha(input: string, alpha: number): string {
  const [r, g, b] = new Color(input).to('srgb').coords.map(v => Math.round(Math.max(0, Math.min(1, v ?? 0)) * 255))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
