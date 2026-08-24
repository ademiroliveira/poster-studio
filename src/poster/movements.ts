import type { MovementId } from './types'
import { CQW } from './units'

/**
 * Art movements, expressed as data rather than as CSS attribute selectors.
 *
 * In the PoC each movement was a `.poster-canvas[data-movement="..."]` block
 * that redefined custom properties. That worked on screen but was invisible to
 * anything trying to serialise the poster, and it caused at least one silent
 * bug: `brutalism` set `--m: 0` on the canvas, which outranked the margin
 * slider writing `--m` on `:root`, so the slider quietly did nothing. Holding
 * these as values means the renderer resolves them explicitly and overrides
 * are impossible to lose.
 */
export interface Movement {
  id: MovementId
  label: string
  /** CSS font-family stack; the families are bundled, not fetched from a CDN. */
  fontFamily: string
  /** Structural grid line width, in poster units. */
  gridThickness: number
  /** SVG stroke-dasharray, or null for a solid rule. */
  gridDash: string | null
  /** Applied to accent geometry. */
  blendMode: 'normal' | 'multiply' | 'difference'
  /** Gaussian blur on accent geometry, in poster units. */
  geoBlur: number
  /** When set, the movement pins the safe-area margin and ignores the slider. */
  marginOverride: number | null
  /** Brutalism draws grid lines in full ink rather than a tint. */
  gridUsesInk: boolean
  /** Vertical stretch applied to display type. */
  titleStretchY: number
  /** Horizontal compression applied to display type. */
  titleStretchX: number
  fontWeightDisplay: number
}

export const MOVEMENTS: Record<MovementId, Movement> = {
  swiss: {
    id: 'swiss',
    label: '🇨🇭 Swiss International — clean, precise',
    fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
    gridThickness: 0.1 * CQW,
    gridDash: null,
    blendMode: 'multiply',
    geoBlur: 0,
    marginOverride: null,
    gridUsesInk: false,
    titleStretchY: 1,
    titleStretchX: 1,
    fontWeightDisplay: 900,
  },
  acid: {
    id: 'acid',
    label: '💊 Acid Graphics — distorted, glowing',
    fontFamily: "'Space Grotesk Variable', 'Space Grotesk', sans-serif",
    gridThickness: 0,
    gridDash: null,
    blendMode: 'difference',
    geoBlur: 4 * CQW,
    marginOverride: null,
    gridUsesInk: false,
    titleStretchY: 1.5,
    titleStretchX: 1,
    fontWeightDisplay: 700,
  },
  brutalism: {
    id: 'brutalism',
    label: '🛹 Web Brutalism — raw, harsh',
    // Replaces the PoC's bare 'Times New Roman', which relied on a font the
    // user's machine might not have and which no exporter could embed.
    fontFamily: "'Instrument Serif', Georgia, serif",
    gridThickness: 0.3 * CQW,
    gridDash: null,
    blendMode: 'normal',
    geoBlur: 0,
    marginOverride: 0,
    gridUsesInk: true,
    titleStretchY: 1,
    titleStretchX: 0.85,
    fontWeightDisplay: 400,
  },
  terminal: {
    id: 'terminal',
    label: '💻 Generative Terminal — code, data',
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
    gridThickness: 0.1 * CQW,
    gridDash: `${0.6 * CQW} ${0.6 * CQW}`,
    blendMode: 'normal',
    geoBlur: 0,
    marginOverride: null,
    gridUsesInk: false,
    titleStretchY: 1,
    titleStretchX: 1,
    fontWeightDisplay: 800,
  },
}

export const MONO_FAMILY = "'JetBrains Mono Variable', 'JetBrains Mono', monospace"

export const MOVEMENT_LIST: readonly Movement[] = Object.values(MOVEMENTS)
