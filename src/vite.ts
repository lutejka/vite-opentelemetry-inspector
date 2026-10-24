import type { DevframeDefinition } from 'devframe'
import type { Plugin } from 'vite'
import type { OpentelemetryDevframe, OpentelemetryDevframeOptions } from './devtools.ts'
import { INGEST_PATH, isInternalRoute } from './otel/ingest.ts'

export { isInternalRoute }

export interface ViteOpentelemetryInspectorOptions {
  /**
   * DevTools panel. Pass `false` to skip mounting the panel (ingest endpoint still works).
   * Extra fields are forwarded to `createOpentelemetryDevframe`.
   */
  devtools?:
    | false
    | (OpentelemetryDevframeOptions & {
      /** OTLP ingest path. Default `/__opentelemetry-ingest`. */
      ingestPath?: string
    })
  /** OTLP HTTP ingest endpoint. `false` disables it. Default `{ path: '/__opentelemetry-ingest' }`. */
  ingest?: false | {
    path?: string
  }
}

/** The parts of the Vite DevTools plugin context used to mount the devframe. */
interface DevToolsContext {
  install: (definition: DevframeDefinition) => Promise<void>
}

function readJsonBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined)
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

/**
 * Standalone Vite plugin exposing the OpenTelemetry inspector as a devframe.
 *
 * - During `vite dev` with Vite DevTools enabled, the panel is added to the
 *   dock (via the `devtools.setup` hook picked up by plugin-scan).
 * - `POST` OTLP JSON (`/v1/traces` and/or `/v1/logs` shapes, or a merged body)
 *   to the ingest endpoint to push traces/logs into the panel — the same
 *   contract as `nuxt-otel`'s `{devServerUrl}/__nuxt-otel-ingest`.
 *
 * ```ts
 * import { viteOpentelemetryInspector } from 'vite-opentelemetry-inspector'
 *
 * export default defineConfig({
 *   plugins: [viteOpentelemetryInspector()],
 * })
 * ```
 */
export function viteOpentelemetryInspector(_options?: ViteOpentelemetryInspectorOptions): Plugin[] {
  const options = _options ?? {}
  const ingestPath = typeof options.ingest === 'object' && options.ingest.path
    ? options.ingest.path
    : (typeof options.devtools === 'object' && options.devtools.ingestPath) || INGEST_PATH
  const ingestEnabled = options.ingest !== false
  const devtoolsEnabled = options.devtools !== false
  const devframeOptions: OpentelemetryDevframeOptions =
    (typeof options.devtools === 'object' ? options.devtools : {}) as OpentelemetryDevframeOptions

  // Calls made before Vite DevTools mounts the devframe, keyed to drop repeats.
  const devframeCalls = new Map<string, (devframe: OpentelemetryDevframe) => void>()
  let devframe: OpentelemetryDevframe | undefined
  function toDevframe(key: string, call: (devframe: OpentelemetryDevframe) => void) {
    if (devframe) {
      call(devframe)
    } else {
      devframeCalls.set(key, call)
    }
  }

  const mainPlugin: Plugin = {
    name: 'vite-plugin-opentelemetry-inspector',
    apply: (_config, env) => !env.isPreview,
    ...(devtoolsEnabled && {
      devtools: {
        capabilities: { build: false },
        async setup(ctx: DevToolsContext) {
          const { createOpentelemetryDevframe } = await import('./devtools')
          devframe ??= createOpentelemetryDevframe(devframeOptions)
          for (const call of devframeCalls.values()) {
            call(devframe)
          }
          devframeCalls.clear()
          await ctx.install(devframe.definition)
        },
      },
    }),
    configureServer(server) {
      if (!ingestEnabled) return
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0] || ''
        if (url !== ingestPath || req.method !== 'POST') {
          next()
          return
        }
        try {
          const body = await readJsonBody(req)
          if (devframe) {
            devframe.ingest(body)
          } else {
            // Buffer until the devframe is installed (same pattern as expose* in fontless).
            const snapshot = JSON.parse(JSON.stringify(body ?? null))
            toDevframe(`ingest:${Date.now()}:${Math.random()}`, d => d.ingest(snapshot))
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end('{}')
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: (error as Error)?.message || 'Invalid JSON body' }))
        }
      })
    },
  }

  return [mainPlugin]
}

export default viteOpentelemetryInspector
