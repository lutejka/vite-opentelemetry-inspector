import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import Unfonts from 'unplugin-fonts/vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { createFixtures } from './app/fixtures.ts'

const BASE = '/__opentelemetry/'
const clientDir = fileURLToPath(new URL('.', import.meta.url))

/**
 * Serve the devframe's RPC backend from the Vite dev server, under the same base
 * the SPA is mounted at by devframe hosts, with fixture traces/spans/logs/metrics.
 */
function devBridge(): Plugin {
  return {
    name: 'otel:devtools-client-bridge',
    apply: 'serve',
    async configureServer(server) {
      const { initDevframe } = await import('devframe/initiate')
      const { createOpentelemetryDevframe } = await import('../src/devtools.ts')
      const devframe = createOpentelemetryDevframe()
      for (const { traces, spans, logs, metrics } of createFixtures()) {
        devframe.exposeTraces(traces)
        devframe.exposeSpans(spans)
        devframe.exposeLogs(logs)
        devframe.exposeMetrics(metrics)
      }
      const instance = initDevframe(devframe.definition, {
        base: BASE,
        distDir: false,
        server: server.httpServer as import('node:http').Server,
        auth: false,
      })
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith(`${BASE}__`)) {
          instance.nodeMiddleware(req, res, next)
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? BASE : './',
  root: clientDir,
  plugins: [
    vue(),
    tailwindcss(),
    Unfonts({
      fontsource: {
        families: [{ name: 'JetBrains Mono Variable', variable: true, fallback: { category: 'monospace' } }],
      },
    }),
    devBridge(),
  ],
  resolve: {
    alias: [
      { find: '~shared', replacement: fileURLToPath(new URL('../src', import.meta.url)) },
      { find: '~/', replacement: `${clientDir}/` },
    ],
  },
  build: {
    outDir: fileURLToPath(new URL('../dist/devtools-client', import.meta.url)),
    emptyOutDir: true,
  },
}))
