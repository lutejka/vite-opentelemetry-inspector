import type { GaugeScale } from './utils/gauge'

declare module 'devframe' {
  interface DevframeSettingsRegistry {
    opentelemetry: {
      /** Per-metric gauge scale overrides, keyed by metric name. */
      gaugeScales?: Record<string, GaugeScale>
    }
  }
}
