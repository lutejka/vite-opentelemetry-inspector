import type { Plugin } from 'vite'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import UnoCSS from '@unocss/vite'
import { defineConfig } from 'vite'
import { createFixtures } from './fixtures.ts'

const BASE = '/__opentelemetry/'
const clientDir = fileURLToPath(new URL('.', import.meta.url))

/**
 * Serve the devframe's RPC backend from the Vite dev server, under the same base
 * the SPA is mounted at by devframe hosts, with fixture traces/spans/logs.
 */
function devBridge(): Plugin {
  return {
    name: 'otel:devtools-client-bridge',
    apply: 'serve',
    async configureServer(server) {
      const { initDevframe } = await import('devframe/initiate')
      const { createOpentelemetryDevframe } = await import('../src/devtools.ts')
      const devframe = createOpentelemetryDevframe()
      for (const { traces, spans, logs } of createFixtures()) {
        devframe.exposeTraces(traces)
        devframe.exposeSpans(spans)
        devframe.exposeLogs(logs)
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
        }
        else {
          next()
        }
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? BASE : './',
  root: clientDir,
  plugins: [vue(), UnoCSS({ configFile: fileURLToPath(new URL('./uno.config.ts', import.meta.url)) }), devBridge()],
  resolve: {
    alias: [
      { find: '~shared', replacement: fileURLToPath(new URL('../src', import.meta.url)) },
      { find: '~/', replacement: `${clientDir}/` },
    ],
  },
  define: {
    __OTEL_PRIMARY_COLOR__: JSON.stringify(process.env.OTEL_DEVTOOLS_PRIMARY_COLOR ?? ''),
  },
  build: {
    outDir: fileURLToPath(new URL('../dist/devtools-client', import.meta.url)),
    emptyOutDir: true,
  },
}))
