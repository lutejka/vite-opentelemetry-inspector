export const ERROR_BAR_CLASS = 'bg-error-500'

/**
 * Waterfall bars follow the app accent: the `primary` ramp, with depth
 * encoded as opacity (root solid, deeper more translucent). Error spans
 * always render on the semantic `error` ramp.
 */
export function getDepthBarColorClass(depth: number, statusCode: number): string {
  void depth
  if (statusCode === 2) return ERROR_BAR_CLASS
  return 'bg-primary-500'
}

export function getDepthBarOpacity(depth: number, statusCode: number): number {
  if (statusCode === 2) return 0.95
  return Math.max(0.45, 1 - depth * 0.12)
}
