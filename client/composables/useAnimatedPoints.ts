import { usePreferredReducedMotion } from '@vueuse/core'
import { onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import { easeOutCubic, sameLayout, tweenPoints } from '~/utils/animation'
import type { KeyedChartPoint } from '~/utils/animation'

/** How long a chart takes to glide into a new layout. */
export const POINT_ANIMATION_DURATION = 300

/**
 * Animate a keyed chart layout whenever its target changes.
 *
 * The returned points trail the target by one eased transition, restarting
 * from wherever they currently are when a new sample arrives mid-flight, so
 * bursts of updates produce continuous motion instead of jumps. Unchanged
 * layouts (e.g. another metric updating) skip the animation entirely.
 */
export function useAnimatedPoints<T extends KeyedChartPoint>(
  source: MaybeRefOrGetter<readonly T[]>,
  duration = POINT_ANIMATION_DURATION,
): Readonly<ShallowRef<readonly T[]>> {
  const displayed = shallowRef<readonly T[]>(toValue(source))
  const reducedMotion = usePreferredReducedMotion()

  /** Layout the current frame started from. */
  let from: readonly T[] = displayed.value
  /** Layout currently being animated toward. */
  let to: readonly T[] = displayed.value
  let startedAt: number | null = null
  let frame: number | null = null

  function stop() {
    if (frame === null) return
    cancelAnimationFrame(frame)
    frame = null
  }

  function step(now: number) {
    if (startedAt === null) startedAt = now
    const progress = duration <= 0 ? 1 : Math.min((now - startedAt) / duration, 1)
    displayed.value = tweenPoints(from, to, easeOutCubic(progress))
    frame = progress < 1 ? requestAnimationFrame(step) : null
  }

  watch(() => toValue(source), (next) => {
    // Most metric updates do not touch this chart; adopt new metadata without moving it.
    if (sameLayout(next, to)) {
      to = next
      if (frame === null) displayed.value = next
      return
    }

    stop()
    from = displayed.value
    to = next
    startedAt = null

    if (
      duration <= 0
      || reducedMotion.value === 'reduce'
      || typeof requestAnimationFrame === 'undefined'
    ) {
      displayed.value = tweenPoints(from, to, 1)
      return
    }

    frame = requestAnimationFrame(step)
  })

  onScopeDispose(stop)

  return displayed
}
