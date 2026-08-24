import type { Axes, LayoutId } from './types'

/**
 * Grid axis generation.
 *
 * Three bugs from the PoC are fixed structurally here rather than patched:
 *
 * 1. `Math.random()` made "Snap Coordinates" irreproducible — you could never
 *    get a poster back once you clicked again. Positions now derive from a
 *    seed, so a poster is fully described by its state and can be shared.
 *
 * 2. Each layout only assigned the axes it happened to use, mutating a shared
 *    physics object. Switching from `brutalist` (which sets v3) to `type-block`
 *    (which does not) left v3 holding a stale value that still affected the
 *    render. `generateAxes` now returns a complete set every time and never
 *    reads previous state.
 *
 * 3. Nothing enforced v1 < v2 < v3, so dragging a slider past its neighbour
 *    produced negative widths in `strict-4-col`. Ordering is now an invariant
 *    of both generation and manual editing (see `setAxis`).
 */

/** Proportions that read as deliberate: halves, thirds, eighths, golden ratio. */
const HARMONICS = [10, 12.5, 20, 25, 33.33, 40, 50, 60, 61.8, 66.66, 75, 80, 87.5] as const

/** Minimum gap between adjacent axes, in percent, so extents stay visible. */
const MIN_GAP = 8

/** Deterministic PRNG (mulberry32) — small, fast, well-distributed enough. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickHarmonic(rng: () => number, min: number, max: number): number {
  const valid = HARMONICS.filter((h) => h >= min && h <= max)
  if (valid.length === 0) return min
  return valid[Math.floor(rng() * valid.length)] ?? min
}

type Range = readonly [min: number, max: number]

interface LayoutRanges {
  v1: Range
  v2: Range
  v3: Range
  h1: Range
  h2: Range
  h3: Range
  stagger: Range
}

/**
 * Every layout specifies every axis. Layouts that do not draw a given axis
 * still get a sane value, so switching layouts is always deterministic.
 *
 * The bands are kept disjoint and ascending. The PoC let ranges overlap — in
 * `anchor`, v2 drew from [60,90] while v3 drew from [50,87.5] — which meant
 * that once all three are sorted into order, the axis a layout intended to sit
 * far right could be dragged into the middle of the poster. Disjoint bands make
 * ordering a no-op and preserve each layout's compositional intent.
 */
const RANGES: Record<LayoutId, LayoutRanges> = {
  anchor: {
    v1: [10, 33.33], v2: [60, 80], v3: [80, 87.5],
    h1: [12.5, 33.33], h2: [60, 80], h3: [80, 87.5],
    stagger: [10, 20],
  },
  matrix: {
    v1: [20, 40], v2: [50, 66.66], v3: [75, 87.5],
    h1: [10, 25], h2: [40, 61.8], h3: [66.66, 87.5],
    stagger: [10, 20],
  },
  brutalist: {
    v1: [10, 25], v2: [40, 60], v3: [66.66, 87.5],
    h1: [20, 40], h2: [50, 66.66], h3: [75, 87.5],
    stagger: [10, 20],
  },
  'strict-4-col': {
    v1: [12.5, 25], v2: [40, 61.8], v3: [66.66, 87.5],
    h1: [20, 40], h2: [60, 80], h3: [80, 87.5],
    stagger: [10, 20],
  },
  'type-block': {
    v1: [33.33, 50], v2: [60, 75], v3: [80, 87.5],
    h1: [10, 25], h2: [50, 66.66], h3: [75, 87.5],
    stagger: [10, 20],
  },
}

/**
 * Force ascending order with a minimum separation, staying within 0–100.
 *
 * Spreading upwards can push the top axis past 100, so any overflow is
 * translated back down afterwards. Three axes need 2 * MIN_GAP of room, which
 * always fits in the 0–100 range, so this cannot fail.
 */
function order(values: [number, number, number]): [number, number, number] {
  const out = [...values].sort((a, b) => a - b) as [number, number, number]
  for (let i = 1; i < out.length; i++) {
    out[i] = Math.max(out[i] as number, (out[i - 1] as number) + MIN_GAP)
  }
  const overflow = (out[2] as number) - 100
  if (overflow > 0) {
    for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) - overflow
  }
  return out
}

export function generateAxes(layout: LayoutId, seed: number): Axes {
  const rng = mulberry32(seed)
  const r = RANGES[layout]

  const [v1, v2, v3] = order([
    pickHarmonic(rng, r.v1[0], r.v1[1]),
    pickHarmonic(rng, r.v2[0], r.v2[1]),
    pickHarmonic(rng, r.v3[0], r.v3[1]),
  ])
  const [h1, h2, h3] = order([
    pickHarmonic(rng, r.h1[0], r.h1[1]),
    pickHarmonic(rng, r.h2[0], r.h2[1]),
    pickHarmonic(rng, r.h3[0], r.h3[1]),
  ])

  return { v1, v2, v3, h1, h2, h3, stagger: pickHarmonic(rng, r.stagger[0], r.stagger[1]) }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

type AxisKey = keyof Axes

const V_KEYS = ['v1', 'v2', 'v3'] as const
const H_KEYS = ['h1', 'h2', 'h3'] as const

/**
 * Set one axis by hand while preserving the ordering invariant: neighbours are
 * pushed out of the way rather than allowed to cross. This is what stops a
 * slider drag from inverting an extent and producing negative geometry.
 */
export function setAxis(axes: Axes, key: AxisKey, value: number): Axes {
  if (key === 'stagger') {
    return { ...axes, stagger: Math.max(0, Math.min(100, value)) }
  }

  const group = (V_KEYS as readonly string[]).includes(key) ? V_KEYS : H_KEYS
  const index = group.indexOf(key as never)

  // The dragged axis is authoritative, but it still has to leave room for the
  // axes on either side of it — otherwise pushing neighbours out of the way
  // just piles them up against 0 or 100 on top of each other.
  const floor = index * MIN_GAP
  const ceiling = 100 - (group.length - 1 - index) * MIN_GAP
  const next: Axes = { ...axes, [key]: Math.max(floor, Math.min(ceiling, value)) }

  // Push later axes forward if this one has overtaken them.
  for (let i = index + 1; i < group.length; i++) {
    const prevKey = group[i - 1] as AxisKey
    const curKey = group[i] as AxisKey
    next[curKey] = Math.max(next[curKey], next[prevKey] + MIN_GAP)
  }
  // Push earlier axes back for the same reason.
  for (let i = index - 1; i >= 0; i--) {
    const nextKey = group[i + 1] as AxisKey
    const curKey = group[i] as AxisKey
    next[curKey] = Math.min(next[curKey], next[nextKey] - MIN_GAP)
  }
  return next
}
