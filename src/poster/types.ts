/**
 * The poster state model.
 *
 * Kept as four independent layers, as in the PoC — content, style, architecture
 * and physics can each be changed without disturbing the others. The difference
 * here is that the whole thing is a plain serialisable value: no DOM, no CSS
 * custom properties, no hidden state. Render is a pure function of this object,
 * which is what makes export, undo, and persistence possible at all.
 */

export type MovementId = 'swiss' | 'acid' | 'brutalism' | 'terminal'

export type LayoutId = 'anchor' | 'matrix' | 'brutalist' | 'strict-4-col' | 'type-block'

export type MicroGridStyle = 'none' | 'blueprint' | 'dots'

/**
 * Title is a 2-tuple and stack a 4-tuple rather than plain arrays. The PoC read
 * `stack[3]` off whatever the model returned, so a three-syllable response
 * printed the word "undefined" onto the poster. Tuples make that a type error
 * here and a validation failure at the AI boundary.
 */
export interface ContentLayer {
  id: string
  concept: string
  title: [string, string]
  stack: [string, string, string, string]
  payload: string
  desc: string
  meta: string
}

export interface StyleLayer {
  movement: MovementId
}

export interface ArchitectureLayer {
  layout: LayoutId
  /** Every axis position derives from this. Same seed + layout = same poster. */
  seed: number
}

/**
 * Grid axis positions, as percentages of the poster's width (v*) or height
 * (h*). `v1 <= v2 <= v3` and `h1 <= h2 <= h3` are invariants maintained by
 * `harmonics.ts`; layout code relies on them to compute non-negative extents.
 */
export interface Axes {
  v1: number
  v2: number
  v3: number
  h1: number
  h2: number
  h3: number
  /** Per-line indent step for stacked layouts, as a percentage of width. */
  stagger: number
}

export interface PhysicsLayer {
  bg: string
  ink: string
  accent: string
  /** Safe-area inset, as a percentage of poster width. */
  margin: number
  axes: Axes
  microGrid: MicroGridStyle
  /** 0–1. How strongly structural grid lines read against the canvas. */
  gridOpacity: number
  /** 0–1. Print grain overlay. */
  noise: number
}

export interface TypographyLayer {
  /** User-facing multiplier on top of the automatic fit-to-width scale. */
  titleScale: number
  /** Letter spacing in em. */
  tracking: number
  /** Line height multiplier. */
  leading: number
}

export interface PosterState {
  paperId: string
  /** Studio mark printed in the corner. Was hard-coded to "a_o" in the PoC. */
  signature: string
  content: ContentLayer
  style: StyleLayer
  architecture: ArchitectureLayer
  physics: PhysicsLayer
  typography: TypographyLayer
}
