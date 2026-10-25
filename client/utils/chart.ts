export interface ChartPoint {
  x: number
  y: number
}

/**
 * Teley-style normalized sparkline `points` attribute for viewBox `0 0 len-1 1`.
 * Returns '' when there are fewer than two values.
 */
export function sparklinePath(values: number[]): string {
  if (values.length < 2) return ''

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  const range = max - min || 1

  return values
    .map((value, index) => `${index},${formatNumber(1 - (value - min) / range)}`)
    .join(' ')
}

/**
 * Linear value ticks covering [min, max] with 1/2/5 steps (~targetCount ticks).
 * Returns [min] for a flat domain and [] for empty/non-finite input.
 */
export function niceValueTicks(min: number, max: number, targetCount = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min > max) [min, max] = [max, min]
  if (min === max) return [min]
  if (!Number.isFinite(targetCount) || targetCount <= 0) targetCount = 4

  const step = niceStep((max - min) / targetCount)
  if (!Number.isFinite(step) || step <= 0) return [min, max]

  const firstIndex = Math.floor(min / step)
  const lastIndex = Math.ceil(max / step)
  const ticks: number[] = []
  for (let index = firstIndex; index <= lastIndex; index++) {
    const value = Number((index * step).toPrecision(12))
    ticks.push(value === 0 ? 0 : value)
  }
  return ticks
}

/**
 * Map domain points into a width x height pixel box, y inverted, x/y clamped to
 * the box. Returns [] for empty input; a single point maps to the box centre.
 */
export function chartPoints(points: ChartPoint[], width: number, height: number): ChartPoint[] {
  if (points.length === 0) return []

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  const spanX = maxX - minX
  const spanY = maxY - minY

  return points.map(point => ({
    x: spanX === 0 ? width / 2 : clamp(((point.x - minX) / spanX) * width, 0, width),
    y: spanY === 0 ? height / 2 : clamp(height - ((point.y - minY) / spanY) * height, 0, height),
  }))
}

/** Build an `M x y L x y ...` path rounded to 2 decimals; '' for empty input. */
export function polylinePath(points: ChartPoint[]): string {
  if (points.length === 0) return ''

  const first = points[0]!
  let path = `M ${formatNumber(first.x)} ${formatNumber(first.y)}`
  for (let index = 1; index < points.length; index++) {
    const point = points[index]!
    path += ` L ${formatNumber(point.x)} ${formatNumber(point.y)}`
  }
  return path
}

/**
 * Close the polyline along the bottom edge (`L lastX height L firstX height Z`);
 * '' for fewer than two points.
 */
export function areaPath(points: ChartPoint[], height: number): string {
  if (points.length < 2) return ''

  const first = points[0]!
  const last = points[points.length - 1]!
  const bottom = formatNumber(height)
  return `${polylinePath(points)} L ${formatNumber(last.x)} ${bottom} L ${formatNumber(first.x)} ${bottom} Z`
}

/** Pick the next 1/2/5 step at or above the raw step. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  for (const multiplier of [1, 2, 5, 10]) {
    const step = multiplier * magnitude
    if (step >= raw - magnitude * 1e-9) return step
  }
  return 10 * magnitude
}

/** Round to 2 decimals and strip trailing zeros (1.234 -> '1.23', 3 -> '3'). */
function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return String(rounded === 0 ? 0 : rounded)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
