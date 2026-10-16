import type { Span } from '~shared/types'
import { getTraceBounds } from './trace'

export interface SpanRowNode {
  span: Span
  depth: number
  offsetPercent: number
  widthPercent: number
  children: SpanRowNode[]
  showChildren: boolean
}

export interface FlatSpanRow {
  span: Span
  depth: number
  offsetPercent: number
  widthPercent: number
  hasChildren: boolean
  childCount: number
  /** True when this row is not the last sibling at its own depth. */
  hasNextSibling: boolean
}

export function spanListToTree(spans: Span[]): SpanRowNode[] {
  const spanMap = new Map<string, Span>()
  const childrenMap = new Map<string | null, Span[]>()

  for (const span of spans) {
    spanMap.set(span.span_id, span)
    const parentId = span.parent_span_id
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(span)
  }

  const rootSpans = spans.filter(span => !span.parent_span_id || !spanMap.has(span.parent_span_id))
  rootSpans.sort((a, b) => a.start_time - b.start_time)

  const { traceStart, traceDuration } = getTraceBounds(spans)
  const roots: SpanRowNode[] = []

  function traverse(span: Span, depth: number): SpanRowNode {
    const offsetPercent = ((span.start_time - traceStart) / traceDuration) * 100
    const widthPercent = (span.duration / traceDuration) * 100

    const childSpans = childrenMap.get(span.span_id) || []
    childSpans.sort((a, b) => a.start_time - b.start_time)

    const children = childSpans.map(child => traverse(child, depth + 1))

    return {
      span: { ...span },
      depth,
      offsetPercent: Math.max(0, offsetPercent),
      widthPercent: Math.max(0.5, widthPercent),
      children,
      showChildren: true,
    }
  }

  for (const rootSpan of rootSpans) {
    roots.push(traverse(rootSpan, 0))
  }

  return roots
}

/**
 * Flatten a span tree into render order, honouring the expanded map.
 * Collapsed subtrees contribute only their (collapsed) parent row.
 */
export function flattenVisibleTree(
  roots: SpanRowNode[],
  isExpanded: (spanId: string) => boolean,
): FlatSpanRow[] {
  const flat: FlatSpanRow[] = []

  function visit(nodes: SpanRowNode[]) {
    nodes.forEach((node, index) => {
      const hasNextSibling = index < nodes.length - 1
      flat.push({
        span: node.span,
        depth: node.depth,
        offsetPercent: node.offsetPercent,
        widthPercent: node.widthPercent,
        hasChildren: node.children.length > 0,
        childCount: countDescendants(node),
        hasNextSibling,
      })
      if (node.children.length > 0 && isExpanded(node.span.span_id)) {
        visit(node.children)
      }
    })
  }

  visit(roots)
  return flat
}

function countDescendants(node: SpanRowNode): number {
  let total = node.children.length
  for (const child of node.children) {
    total += countDescendants(child)
  }
  return total
}
