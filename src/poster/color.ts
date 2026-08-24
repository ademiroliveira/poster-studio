/**
 * Colour helpers.
 *
 * The PoC derived tints with CSS `color-mix()`. That is fine in a browser but
 * meaningless to a canvas rasteriser or a PDF writer, both of which need a
 * literal colour. Mixing is done numerically here so the same value reaches the
 * screen and the export.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export function parseHex(hex: string): Rgb | null {
  const m = HEX.exec(hex.trim())
  if (!m) return null
  let body = m[1] as string
  if (body.length === 3) {
    body = body
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const n = parseInt(body, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Blend `amount` (0–1) of `a` into `b`. */
export function mix(a: string, b: string, amount: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return a
  const t = Math.max(0, Math.min(1, amount))
  return toHex({
    r: ca.r * t + cb.r * (1 - t),
    g: ca.g * t + cb.g * (1 - t),
    b: ca.b * t + cb.b * (1 - t),
  })
}

/** Relative luminance per WCAG 2.1. */
export function luminance(hex: string): number {
  const c = parseHex(hex)
  if (!c) return 0
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * The AI prompt asks for palettes where "contrast is key" but nothing ever
 * checked. A poster whose ink barely separates from its canvas is unreadable at
 * any size, so generated palettes are validated against this.
 */
export const MIN_POSTER_CONTRAST = 3

export function isLegible(ink: string, bg: string): boolean {
  return contrastRatio(ink, bg) >= MIN_POSTER_CONTRAST
}

/** Force ink away from the canvas colour until it is readable. */
export function ensureLegible(ink: string, bg: string): string {
  if (isLegible(ink, bg)) return ink
  const target = luminance(bg) > 0.4 ? '#101010' : '#F5F5F5'
  for (let t = 0.25; t <= 1; t += 0.25) {
    const candidate = mix(target, ink, t)
    if (isLegible(candidate, bg)) return candidate
  }
  return target
}
