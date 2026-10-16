import { viteOpentelemetryInspector } from 'vite-opentelemetry-inspector'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Enables the Vite DevTools host, which picks up this plugin's
  // `devtools.setup` hook and shows the OpenTelemetry panel in its dock.
  devtools: true,
  plugins: [viteOpentelemetryInspector()],
})
