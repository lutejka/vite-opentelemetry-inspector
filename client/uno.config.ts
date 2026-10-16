import process from 'node:process'
import { generateColorRamp, presetAnthonyDesign } from '@antfu/design/unocss'
import presetIcons from '@unocss/preset-icons'
import presetWebFonts from '@unocss/preset-web-fonts'
import presetWind4 from '@unocss/preset-wind4'
import transformerDirectives from '@unocss/transformer-directives'
import transformerVariantGroup from '@unocss/transformer-variant-group'
import { defineConfig } from 'unocss'

/**
 * Build-time accent (`OTEL_DEVTOOLS_PRIMARY_COLOR`), falling back to the
 * DevTools indigo. The host hub brand (`--devframe-primary`) and the explicit
 * client override (`--otel-primary`, set from `main.ts`) retint the same
 * stops at runtime via the preflight below.
 */
function resolveBuildPrimary(): string {
  const env = process.env.OTEL_DEVTOOLS_PRIMARY_COLOR?.trim()
  if (env) {
    try {
      generateColorRamp(env)
      return env
    }
    catch {
      // Invalid color — fall through to the default.
    }
  }
  return '#6b84fd'
}

const buildPrimary = resolveBuildPrimary()
const bakedRamp = generateColorRamp(buildPrimary)

// Stops the UI actually references (mirrors devframe's overridable set).
const BRAND_STOPS: Array<[string, number]> = [
  ['DEFAULT', 0],
  ['600', 9],
  ['500', 18],
  ['400', 34],
  ['300', 54],
]

/**
 * Runtime brand override (devframe `primary-ramp.css` model): derive the
 * referenced `--colors-primary-*` stops from `--otel-primary` (explicit
 * client override) or `--devframe-primary` (host hub brand). When neither is
 * set the intermediate vars are guaranteed-invalid, so each stop falls back
 * to the baked build-time hex. Unlayered so it wins over the theme layer.
 */
function brandOverrideCss(): string {
  const lines = [':root {', '  --otel-brand: var(--otel-primary, var(--devframe-primary));']
  for (const [stop, white] of BRAND_STOPS)
    lines.push(`  --otel-brand-${stop}: color-mix(in oklab, var(--otel-brand), white ${white}%);`)
  for (const [stop] of BRAND_STOPS) {
    const baked = bakedRamp[stop]
    lines.push(`  --colors-primary-${stop}: var(--otel-brand-${stop}, ${baked});`)
  }
  lines.push('}')
  return lines.join('\n')
}

export default defineConfig({
  presets: [
    presetAnthonyDesign({ primary: buildPrimary }),
    presetWind4(),
    presetIcons(),
    presetWebFonts({ fonts: { sans: 'DM Sans', mono: 'DM Mono' } }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  shortcuts: {
    // Named z-index layers (ordering only); the preset blocks plain z-index.
    'z-nav': 'z-[30]',
    'z-dropdown': 'z-[40]',
    'z-tooltip': 'z-[45]',
    'z-toast': 'z-[50]',
    'z-modal-backdrop': 'z-[60]',
    'z-modal-content': 'z-[70]',
    'z-drawer-backdrop': 'z-[80]',
    'z-drawer-content': 'z-[90]',
  },
  // Closed dynamic palette set used by the app (hashed/mapped badge colors
  // are computed at runtime, so UnoCSS cannot extract them from source).
  safelist: [
    'badge-color-red',
    'badge-color-amber',
    'badge-color-green',
    'badge-color-blue',
    'badge-color-violet',
    'badge-color-gray',
    'badge-color-cyan',
    'badge-color-emerald',
  ],
  preflights: [{ getCSS: () => brandOverrideCss() }],
})
