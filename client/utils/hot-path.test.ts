import { describe, expect, it } from 'vitest'
import type { Span } from '~shared/types'
import { findHotPath, getTailTolerance } from './hot-path'

function makeSpan(id: string, parent: string | null, start: number, end: number): Span {
  return {
    span_id: id,
    trace_id: 'trace',
    parent_span_id: parent,
    name: id,
    kind: 0,
    start_time: start,
    end_time: end,
    duration: end - start,
    status_code: 0,
    status_message: null,
    attributes: {},
    events: [],
    links: [],
  }
}

function ids(spans: Span[]): string[] {
  return spans.map(span => span.span_id)
}

describe('getTailTolerance', () => {
  it('allows a 5% tail of the parent duration', () => {
    expect(getTailTolerance(420)).toBeCloseTo(21, 10)
  })

  it('never allows less than 1ms', () => {
    expect(getTailTolerance(10)).toBe(1)
  })

  it('caps the allowance at 25ms for long spans', () => {
    expect(getTailTolerance(10_000)).toBe(25)
  })

  it('treats a zero-length parent as the floor', () => {
    expect(getTailTolerance(0)).toBe(1)
  })
})

describe('findHotPath', () => {
  it('returns no spans for an empty trace', () => {
    expect(findHotPath([])).toEqual([])
  })

  it('returns the root when it has no children', () => {
    const root = makeSpan('root', null, 0, 420)
    expect(ids(findHotPath([root]))).toEqual(['root'])
  })

  it('keeps every serial phase a parent ran through', () => {
    const root = makeSpan('root', null, 0, 1180)
    const usage = makeSpan('fetch.usage', 'root', 12, 432)
    const discounts = makeSpan('apply.discounts', 'root', 440, 650)
    const pdf = makeSpan('render.pdf', 'root', 660, 1140)
    const email = makeSpan('email.send', 'root', 1150, 1174)
    const fonts = makeSpan('embed.fonts', 'render.pdf', 700, 880)

    expect(ids(findHotPath([root, usage, discounts, pdf, fonts, email]))).toEqual([
      'root',
      'fetch.usage',
      'apply.discounts',
      'render.pdf',
      'email.send',
    ])
  })

  it('leaves out the shards of a lookup the request moved past', () => {
    const root = makeSpan('root', null, 0, 310)
    const parse = makeSpan('parse.query', 'root', 4, 22)
    const lookup = makeSpan('index.lookup', 'root', 26, 166)
    const shardA = makeSpan('shard.a', 'index.lookup', 30, 118)
    const shardB = makeSpan('shard.b', 'index.lookup', 34, 138)
    const rank = makeSpan('rank.results', 'root', 170, 266)
    const cache = makeSpan('cache.write', 'root', 270, 298)

    expect(ids(findHotPath([root, parse, lookup, shardA, shardB, rank, cache]))).toEqual([
      'root',
      'parse.query',
      'index.lookup',
      'rank.results',
      'cache.write',
    ])
  })

  it('drops a child that is fully covered by a longer sibling', () => {
    const root = makeSpan('root', null, 0, 1000)
    const longer = makeSpan('longer', 'root', 0, 900)
    const shadowed = makeSpan('shadowed', 'root', 0, 400)

    expect(ids(findHotPath([root, longer, shadowed]))).toEqual(['root', 'longer'])
  })

  it('keeps partially overlapping siblings', () => {
    const root = makeSpan('root', null, 0, 1000)
    const first = makeSpan('first', 'root', 0, 400)
    const second = makeSpan('second', 'root', 200, 600)

    expect(ids(findHotPath([root, first, second]))).toEqual(['root', 'first', 'second'])
  })

  it('descends through the child the parent finished with', () => {
    const root = makeSpan('root', null, 0, 500)
    const middle = makeSpan('middle', 'root', 0, 480)
    const leaf = makeSpan('leaf', 'middle', 20, 470)

    expect(ids(findHotPath([root, middle, leaf]))).toEqual(['root', 'middle', 'leaf'])
  })

  it('stops descending when the parent finished well after its last child', () => {
    const root = makeSpan('root', null, 0, 1000)
    const middle = makeSpan('middle', 'root', 0, 1000)
    const early = makeSpan('early', 'middle', 100, 500)
    const nested = makeSpan('nested', 'early', 150, 400)

    expect(ids(findHotPath([root, middle, early, nested]))).toEqual(['root', 'middle', 'early'])
  })

  it('keeps a child that finishes after its parent because of clock skew', () => {
    const root = makeSpan('root', null, 0, 100)
    const child = makeSpan('child', 'root', 10, 130)
    const grandchild = makeSpan('grandchild', 'child', 20, 125)

    expect(ids(findHotPath([root, child, grandchild]))).toEqual(['root', 'child', 'grandchild'])
  })

  it('starts from the root that finishes last when there are several', () => {
    const early = makeSpan('early', null, 0, 100)
    const late = makeSpan('late', null, 200, 600)

    expect(ids(findHotPath([early, late]))).toEqual(['late'])
  })

  it('treats a span with a missing parent as a root', () => {
    const orphan = makeSpan('orphan', 'ghost', 0, 50)

    expect(ids(findHotPath([orphan]))).toEqual(['orphan'])
  })

  it('returns nothing when every span has a parent in the trace', () => {
    const a = makeSpan('a', 'b', 0, 100)
    const b = makeSpan('b', 'a', 0, 100)

    expect(findHotPath([a, b])).toEqual([])
  })

  it('does not revisit a span id that appears twice', () => {
    const root = makeSpan('a', null, 0, 100)
    const child = makeSpan('b', 'a', 0, 100)
    const duplicate = makeSpan('a', 'b', 0, 100)

    expect(ids(findHotPath([root, child, duplicate]))).toEqual(['a', 'b'])
  })
})
