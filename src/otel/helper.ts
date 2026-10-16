import type { IKeyValue } from './parser.ts'

/**
 * Extract attribute value from OTLP KeyValue format.
 * Ported from `nuxt-otel/src/runtime/otel/parse/helper.ts`.
 */
export function getAttributeValue(value: IKeyValue['value']): unknown {
  if (value.stringValue !== undefined) return value.stringValue
  if (value.intValue !== undefined) return Number(value.intValue)
  if (value.doubleValue !== undefined) return value.doubleValue
  if (value.boolValue !== undefined) return value.boolValue
  if (value.arrayValue !== undefined) {
    return value.arrayValue.values.map(v => getAttributeValue(v))
  }
  if (value.kvlistValue !== undefined) {
    return parseAttributes(value.kvlistValue.values)
  }
  if (value.bytesValue !== undefined) return value.bytesValue
  return null
}

/**
 * Convert OTLP attributes array to object.
 */
export function parseAttributes(attributes?: IKeyValue[]): Record<string, unknown> {
  if (!attributes) return {}

  const result: Record<string, unknown> = {}
  for (const attr of attributes) {
    result[attr.key] = getAttributeValue(attr.value)
  }
  return result
}

export function nanoToMs(nano: string | number): number {
  return Math.floor(Number(nano) / 1000000)
}
