import { createApp } from 'vue'
import App from './App.vue'
import 'vue-afloat/style.css'
import '@antfu/design/styles.css'
import 'uno.css'

declare const __OTEL_PRIMARY_COLOR__: string | undefined

// Explicit build-time accent (`OTEL_DEVTOOLS_PRIMARY_COLOR`) takes precedence
// over the host hub brand (`--devframe-primary`, set by the parent frame).
// Both feed the `--colors-primary-*` override in `uno.config.ts`.
try {
  if (typeof __OTEL_PRIMARY_COLOR__ === 'string'
    && __OTEL_PRIMARY_COLOR__
    && CSS.supports('color', __OTEL_PRIMARY_COLOR__)) {
    document.documentElement.style.setProperty('--otel-primary', __OTEL_PRIMARY_COLOR__)
  }
}
catch {
  // Custom property unsupported — default accent stays intact.
}

createApp(App).mount('#app')
