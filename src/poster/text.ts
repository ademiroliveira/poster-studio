/**
 * Text measurement, wrapping and fitting.
 *
 * SVG `<text>` does not wrap, and `<foreignObject>` — the obvious escape hatch —
 * is refused by browsers when an SVG is rasterised through an `<img>`, and is
 * unsupported by every SVG-to-PDF path. So an exportable poster has to lay out
 * its own copy. Everything here measures against a real 2D context, which means
 * the preview and the export agree by construction.
 *
 * This also replaces the PoC's `smartScale = 12 / titleLength` heuristic, which
 * guessed at width from character count and so overflowed on wide letterforms
 * and left gaps on narrow ones.
 */

let ctx: CanvasRenderingContext2D | null = null

function context(): CanvasRenderingContext2D {
  if (!ctx) {
    const canvas = document.createElement('canvas')
    const c = canvas.getContext('2d')
    if (!c) throw new Error('2D canvas context unavailable; cannot measure text')
    ctx = c
  }
  return ctx
}

export interface FontSpec {
  family: string
  weight: number
  size: number
  /** Letter spacing in em, matching the CSS/SVG convention. */
  tracking: number
}

function fontString(f: FontSpec): string {
  return `${f.weight} ${f.size}px ${f.family}`
}

const measureCache = new Map<string, number>()

export function measureText(text: string, font: FontSpec): number {
  const key = `${fontString(font)}|${font.tracking}|${text}`
  const cached = measureCache.get(key)
  if (cached !== undefined) return cached

  const c = context()
  c.font = fontString(font)
  const base = c.measureText(text).width
  // Tracking applies between glyphs, so there are length-1 gaps. Doing this
  // arithmetically rather than via ctx.letterSpacing keeps measurement
  // identical across browsers that disagree about trailing spacing.
  const gaps = Math.max(0, text.length - 1)
  const width = base + gaps * font.tracking * font.size

  measureCache.set(key, width)
  return width
}

/** Invalidate measurements — call once webfonts finish loading. */
export function clearMeasureCache(): void {
  measureCache.clear()
}

/**
 * Largest font size at which `text` fits within `maxWidth`.
 * Measurement is very close to linear in size, so one ratio step lands within a
 * fraction of a percent; a short refinement loop absorbs hinting non-linearity.
 */
export function fitToWidth(text: string, maxWidth: number, font: FontSpec, maxSize: number): number {
  if (!text) return maxSize
  const atMax = measureText(text, { ...font, size: maxSize })
  if (atMax <= maxWidth) return maxSize

  let size = maxSize * (maxWidth / atMax)
  for (let i = 0; i < 4; i++) {
    const w = measureText(text, { ...font, size })
    if (w <= maxWidth) break
    size *= maxWidth / w
  }
  return Math.max(1, size)
}

/** Greedy word wrap. Words longer than the line are broken mid-word. */
export function wrapText(text: string, maxWidth: number, font: FontSpec): string[] {
  if (!text.trim()) return []
  const lines: string[] = []
  let current = ''

  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word
    if (measureText(candidate, font) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) {
      lines.push(current)
      current = ''
    }
    if (measureText(word, font) <= maxWidth) {
      current = word
    } else {
      // A single unbreakable token wider than the column.
      let chunk = ''
      for (const ch of word) {
        if (measureText(chunk + ch, font) > maxWidth && chunk) {
          lines.push(chunk)
          chunk = ch
        } else {
          chunk += ch
        }
      }
      current = chunk
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Wrap, then drop any lines that would overflow the available height, marking
 * the final visible line with an ellipsis. Copy overrunning the poster edge was
 * a standing problem in the PoC, which simply let it bleed off the canvas.
 */
export function wrapClamped(
  text: string,
  maxWidth: number,
  font: FontSpec,
  lineHeight: number,
  maxHeight: number,
): string[] {
  const lines = wrapText(text, maxWidth, font)
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight))
  if (lines.length <= maxLines) return lines

  const kept = lines.slice(0, maxLines)
  const last = kept[maxLines - 1]
  if (last !== undefined) kept[maxLines - 1] = `${last.replace(/[\s.,;:]+$/, '')}…`
  return kept
}
