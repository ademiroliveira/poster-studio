import { describe, it, expect } from 'vitest'
import { generateAxes, setAxis } from './harmonics'
import type { Axes, LayoutId } from './types'

const LAYOUTS: LayoutId[] = ['anchor', 'matrix', 'brutalist', 'strict-4-col', 'type-block']

function assertOrdered(a: Axes) {
  expect(a.v1).toBeLessThan(a.v2)
  expect(a.v2).toBeLessThan(a.v3)
  expect(a.h1).toBeLessThan(a.h2)
  expect(a.h2).toBeLessThan(a.h3)
}

function assertInBounds(a: Axes) {
  for (const v of Object.values(a)) {
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(100)
  }
}

describe('generateAxes', () => {
  it('is deterministic for a given layout and seed', () => {
    for (const layout of LAYOUTS) {
      expect(generateAxes(layout, 12345)).toEqual(generateAxes(layout, 12345))
    }
  })

  it('always returns a complete axis set, so nothing leaks between layouts', () => {
    const keys = ['v1', 'v2', 'v3', 'h1', 'h2', 'h3', 'stagger']
    for (const layout of LAYOUTS) {
      const axes = generateAxes(layout, 999)
      expect(Object.keys(axes).sort()).toEqual([...keys].sort())
      for (const k of keys) expect(Number.isFinite(axes[k as keyof Axes])).toBe(true)
    }
  })

  it('keeps axes ordered and in bounds across many seeds', () => {
    for (const layout of LAYOUTS) {
      for (let seed = 0; seed < 400; seed++) {
        const axes = generateAxes(layout, seed)
        assertOrdered(axes)
        assertInBounds(axes)
      }
    }
  })

  it('produces varied output rather than one fixed arrangement', () => {
    const seen = new Set(
      Array.from({ length: 100 }, (_, s) => JSON.stringify(generateAxes('anchor', s))),
    )
    expect(seen.size).toBeGreaterThan(5)
  })
})

describe('setAxis', () => {
  it('preserves ordering when an axis is dragged past its neighbour', () => {
    const base = generateAxes('strict-4-col', 7)
    // Drag v1 far beyond v3 — the case that produced negative-width geometry.
    assertOrdered(setAxis(base, 'v1', 95))
    assertOrdered(setAxis(base, 'v3', 0))
    assertOrdered(setAxis(base, 'h1', 100))
    assertOrdered(setAxis(base, 'h3', 0))
  })

  it('clamps out-of-range input', () => {
    const base = generateAxes('anchor', 3)
    assertInBounds(setAxis(base, 'v2', 500))
    assertInBounds(setAxis(base, 'v2', -500))
  })

  it('leaves stagger free of the ordering constraint', () => {
    const base = generateAxes('brutalist', 11)
    expect(setAxis(base, 'stagger', 22).stagger).toBe(22)
  })
})
