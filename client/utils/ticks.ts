export interface TimeTick {
  time: number
  left: number
}

export interface TimeTickOptions {
  /** Total span duration in milliseconds. */
  duration: number
  /** Full timeline width in pixels at the current zoom level. */
  contentWidth: number
  /** Visible timeline width in pixels (excludes the name column). */
  viewportWidth: number
  /** Horizontal scroll offset of the timeline in pixels. */
  scrollLeft: number
  /** Distance between the timeline edge and the time track, in pixels. */
  inset?: number
  /** Desired minimum distance between labels, in pixels. */
  minSpacing?: number
}

const DEFAULT_MIN_SPACING = 90
const MAX_TICKS = 40

/**
 * Pick the ticks visible in the current slice of the timeline, positioned in
 * viewport coordinates. Ticks are anchored to time (so a tick always sits above
 * the instant it describes) and spaced with a 1/2/5 sequence so labels stay
 * readable at any zoom level.
 */
export function getTimeTicks({
  duration,
  contentWidth,
  viewportWidth,
  scrollLeft,
  inset = 0,
  minSpacing = DEFAULT_MIN_SPACING,
}: TimeTickOptions): TimeTick[] {
  if (!(duration > 0) || !(contentWidth > 0) || !(viewportWidth > 0)) return []

  const pxPerMs = contentWidth / duration
  const step = niceStep(minSpacing / pxPerMs)
  const visibleStart = Math.max(0, (scrollLeft - inset) / pxPerMs)
  const visibleEnd = Math.min(duration, (scrollLeft + viewportWidth - inset) / pxPerMs)
  const epsilon = step * 1e-9

  const ticks: TimeTick[] = []
  const firstIndex = Math.max(0, Math.ceil(visibleStart / step - 1e-9))

  for (let index = firstIndex; ticks.length < MAX_TICKS; index++) {
    const time = index * step
    if (time > visibleEnd + epsilon || time > duration + epsilon) break
    ticks.push({ time: round(time), left: inset + time * pxPerMs - scrollLeft })
  }

  return ticks
}

function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  for (const multiplier of [1, 2, 5, 10]) {
    const step = multiplier * magnitude
    if (step >= raw - magnitude * 1e-9) return step
  }
  return 10 * magnitude
}

/** Trim binary floating point noise (e.g. 380.00000000000006) from tick times. */
function round(value: number): number {
  return Number(value.toPrecision(12))
}
