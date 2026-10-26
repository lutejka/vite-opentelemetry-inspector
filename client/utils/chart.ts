export interface ChartPoint {
  x: number
  y: number
}

/** A named series of domain points, drawn on a shared scale with its siblings. */
export interface ChartSeries {
  key: string
  label: string
  points: ChartPoint[]
}

/** Bounds of a chart's x/y domain. */
export interface ChartDomain {
  minX: number
  maxX: number
  minY: number
  maxY: number
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
 * Index of the point whose x is closest to the given x. Keeps the earlier point
 * on a tie; returns 0 for empty input.
 */
export function nearestPointIndex(points: readonly Pick<ChartPoint, 'x'>[], x: number): number {
  let nearest = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < points.length; index++) {
    const distance = Math.abs(points[index]!.x - x)
    if (distance < bestDistance) {
      bestDistance = distance
      nearest = index
    }
  }
  return nearest
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
 * First point whose x equals the given sample coordinate, or null when the
 * series has no sample at that x. Used to keep hover readouts honest when
 * series are sparse and do not share every timestamp.
 */
export function pointAtX<T extends Pick<ChartPoint, 'x'>>(points: readonly T[], x: number): T | null {
  return points.find(point => point.x === x) ?? null
}

/**
 * Bounds of a point set, or `null` for empty input. Callers are responsible for
 * filtering non-finite values first.
 */
export function chartDomain(points: readonly ChartPoint[]): ChartDomain | null {
  if (points.length === 0) return null

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

  return { minX, maxX, minY, maxY }
}

/**
 * Map one domain point into a width x height pixel box, y inverted, x/y clamped
 * to the box. Degenerate axes map to the box centre.
 */
export function mapChartPoint(
  point: ChartPoint,
  domain: ChartDomain,
  width: number,
  height: number,
): ChartPoint {
  const spanX = domain.maxX - domain.minX
  const spanY = domain.maxY - domain.minY

  return {
    x: spanX === 0 ? width / 2 : clamp(((point.x - domain.minX) / spanX) * width, 0, width),
    y: spanY === 0 ? height / 2 : clamp(height - ((point.y - domain.minY) / spanY) * height, 0, height),
  }
}

/**
 * Map domain points into a width x height pixel box, y inverted, x/y clamped to
 * the box. Returns [] for empty input; a single point maps to the box centre.
 */
export function chartPoints(points: ChartPoint[], width: number, height: number): ChartPoint[] {
  const domain = chartDomain(points)
  return domain ? points.map(point => mapChartPoint(point, domain, width, height)) : []
}

/** Build an `M x y L x y ...` path rounded to 2 decimals; '' for empty input. */
export function polylinePath(points: readonly ChartPoint[]): string {
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
export function areaPath(points: readonly ChartPoint[], height: number): string {
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
