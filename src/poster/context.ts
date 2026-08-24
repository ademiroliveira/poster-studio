import type { Movement } from './movements'
import { MOVEMENTS, MONO_FAMILY } from './movements'
import type { PosterState } from './types'
import { mix } from './color'
import { fitToWidth, type FontSpec } from './text'
import { CQW, POSTER_WIDTH, paperById, posterHeight, type PaperSize } from './units'

/**
 * Everything a layout needs, resolved once from state.
 *
 * Layouts are pure functions of this object. They never read the DOM, never
 * touch CSS variables, and never mutate anything — which is precisely what lets
 * the same code drive the on-screen preview, the PNG rasteriser and the PDF
 * writer without divergence.
 */
export interface RenderContext {
  state: PosterState
  movement: Movement
  paper: PaperSize

  /** Poster extent in coordinate units. */
  width: number
  height: number

  /** Safe area, in absolute coordinate units. */
  safe: { x: number; y: number; width: number; height: number }

  bg: string
  ink: string
  accent: string
  mutedInk: string
  gridColor: string

  /** Absolute x for a vertical axis expressed as a percentage of the safe area. */
  vx: (percent: number) => number
  /** Absolute y for a horizontal axis expressed as a percentage of the safe area. */
  hy: (percent: number) => number

  /** Font specs at a given size in poster units. */
  display: (size: number) => FontSpec
  body: (size?: number) => FontSpec
  mono: (size?: number) => FontSpec

  /** Largest display size at which `text` fits `maxWidth`, honouring user scale. */
  fitDisplay: (text: string, maxWidth: number, baseSize: number) => number

  /** As `fitDisplay`, but also constrained by the vertical room available. */
  fitDisplayBox: (text: string, maxWidth: number, maxHeight: number, baseSize: number) => number

  /** Line advance for a given font size. */
  lineHeight: (size: number) => number

  /** Vertical space one display line occupies, including movement stretch. */
  displayBlockHeight: (size: number) => number
}

/** Base type sizes, ported from the PoC's cqw values (1cqw = 10u). */
export const TYPE_SCALE = {
  massive: 22 * CQW,
  display: 15 * CQW,
  stack: 26 * CQW,
  body: 2.2 * CQW,
  mono: 1.8 * CQW,
} as const

export function buildContext(state: PosterState): RenderContext {
  const movement = MOVEMENTS[state.style.movement]
  const paper = paperById(state.paperId)
  const width = POSTER_WIDTH
  const height = posterHeight(paper)

  // A movement may pin the margin (brutalism bleeds to the edge). In the PoC
  // this silently disabled the margin slider; here the UI is told about it.
  const marginPercent = movement.marginOverride ?? state.physics.margin
  const margin = (marginPercent / 100) * width

  const safe = {
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
  }

  const { bg, ink, accent } = state.physics
  const mutedInk = mix(ink, bg, 0.6)
  const gridColor = movement.gridUsesInk ? ink : mix(ink, bg, state.physics.gridOpacity)

  const { tracking, leading, titleScale } = state.typography

  const display = (size: number): FontSpec => ({
    family: movement.fontFamily,
    weight: movement.fontWeightDisplay,
    size,
    tracking,
  })
  const body = (size = TYPE_SCALE.body): FontSpec => ({
    family: movement.fontFamily,
    weight: 500,
    size,
    tracking: 0,
  })
  const mono = (size = TYPE_SCALE.mono): FontSpec => ({
    family: MONO_FAMILY,
    weight: 400,
    size,
    tracking: 0,
  })

  /** Vertical space one display line occupies, including its stretch. */
  const displayBlockHeight = (size: number) => size * movement.titleStretchY

  const fitDisplay = (text: string, maxWidth: number, baseSize: number) => {
    const requested = baseSize * titleScale
    const effectiveWidth = maxWidth / movement.titleStretchX
    return fitToWidth(text, effectiveWidth, display(requested), requested)
  }

  return {
    state,
    movement,
    paper,
    width,
    height,
    safe,
    bg,
    ink,
    accent,
    mutedInk,
    gridColor,
    vx: (percent) => safe.x + (percent / 100) * safe.width,
    hy: (percent) => safe.y + (percent / 100) * safe.height,
    display,
    body,
    mono,
    // Measure at the user's requested size, then shrink only if it overflows.
    // The horizontal stretch some movements apply has to be accounted for, or
    // brutalism's condensed type would be shrunk twice.
    fitDisplay,
    // Titles also have to respect the band they sit in. Without this the
    // display type overruns whatever is below it — in the PoC the second title
    // line routinely landed on top of the body copy.
    fitDisplayBox: (text, maxWidth, maxHeight, baseSize) => {
      const byWidth = fitDisplay(text, maxWidth, baseSize)
      if (maxHeight <= 0) return byWidth
      const byHeight = maxHeight / movement.titleStretchY
      return Math.max(1, Math.min(byWidth, byHeight))
    },
    lineHeight: (size) => size * leading,
    displayBlockHeight,
  }
}
