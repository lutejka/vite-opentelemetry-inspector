import type { Span } from '~shared/types'

/** A span that ends within this floor of its parent still counts as "the span we were waiting on". */
export const HOT_PATH_MIN_TAIL_MS = 1
/** Upper bound on the tail allowance: clock skew and timer jitter are bounded, not proportional forever. */
export const HOT_PATH_MAX_TAIL_MS = 25
/** Share of the parent's duration that counts as "ends together with the parent". */
export const HOT_PATH_TAIL_RATIO = 0.05

/**
 * How much earlier than its parent a child may end and still be treated as the
 * span the parent was waiting on. 5% of the parent's duration, clamped to
 * 1–25ms so short spans aren't over-forgiving and long ones aren't either.
 */
export function getTailTolerance(parentDuration: number): number {
  const scaled = Math.max(0, parentDuration) * HOT_PATH_TAIL_RATIO
  return Math.min(HOT_PATH_MAX_TAIL_MS, Math.max(HOT_PATH_MIN_TAIL_MS, scaled))
}

function latestEnding(children: Span[]): Span | undefined {
  let latest: Span | undefined
  for (const child of children) {
    if (!latest) {
      latest = child
    } else if (child.end_time > latest.end_time) {
      latest = child
    } else if (child.end_time === latest.end_time && child.duration > latest.duration) {
      latest = child
    }
  }
  return latest
}

/** True when a sibling runs over the whole of `child` (parallel work that adds no wall-clock time). */
function isShadowed(child: Span, siblings: Span[]): boolean {
  return siblings.some(sibling =>
    sibling !== child
    && sibling.start_time <= child.start_time
    && sibling.end_time >= child.end_time
    && (sibling.duration > child.duration
      || (sibling.duration === child.duration && sibling.span_id < child.span_id))
  )
}

/**
 * The hot path of a trace: the spans that carried its wall-clock time.
 *
 * Starting at the root that finishes last, keep two things:
 *
 * - Every child the span ran through in sequence — a phase the request moved
 *   on from still counts, so `invoice.generate` keeps `fetch.usage`,
 *   `apply.discounts`, `render.pdf` and `email.send`. Children fully covered by
 *   a longer sibling are parallel work and are dropped.
 * - Descend only through the child the span was still waiting on when it
 *   finished. That is why `embed.fonts` (inside `render.pdf`, which the request
 *   had already moved past) is not on the path, while `render.pdf` itself is.
 *
 * Spans whose parent isn't in the list are treated as roots (matching
 * `spanListToTree`). Returns an empty array when nothing qualifies as a root.
 */
export function findHotPath(spans: Span[]): Span[] {
  if (spans.length === 0) {
    return []
  }

  const byId = new Map<string, Span>()
  for (const span of spans) {
    byId.set(span.span_id, span)
  }

  const children = new Map<string, Span[]>()
  const roots: Span[] = []
  for (const span of spans) {
    const parent = span.parent_span_id ? byId.get(span.parent_span_id) : undefined
    if (!parent || parent.span_id === span.span_id) {
      roots.push(span)
      continue
    }
    const siblings = children.get(parent.span_id)
    if (siblings) {
      siblings.push(span)
    } else {
      children.set(parent.span_id, [span])
    }
  }

  const root = roots.reduce<Span | undefined>(
    (last, span) => (!last || span.end_time > last.end_time ? span : last),
    undefined,
  )
  if (!root) {
    return []
  }

  const path: Span[] = [root]
  const visited = new Set<string>([root.span_id])

  function add(span: Span) {
    if (visited.has(span.span_id)) {
      return
    }
    visited.add(span.span_id)
    path.push(span)
  }

  let current = root

  while (true) {
    const siblings = (children.get(current.span_id) ?? [])
      .filter(child => !visited.has(child.span_id))
      .sort((a, b) => a.start_time - b.start_time)

    // Everything the span ran through in sequence is on the path, even the
    // phases it moved on from. Fully overlapped children are not.
    for (const child of siblings) {
      if (!isShadowed(child, siblings)) {
        add(child)
      }
    }

    const next = latestEnding(siblings)
    if (!next) {
      break
    }
    // The parent kept working after its last child returned, so the parent is
    // where this branch of the path ends.
    if (current.end_time - next.end_time > getTailTolerance(current.duration)) {
      break
    }
    add(next)
    current = next
  }

  return path
}
