/**
 * Poster coordinate system.
 *
 * The PoC laid everything out in `cqw`/`cqh` container-query units, which meant
 * the poster's geometry was a function of the browser window. That made the
 * design un-exportable (there is no "window" when rasterising to 300dpi) and
 * made the aspect ratio drift as the window changed shape.
 *
 * Instead the poster has its own fixed coordinate space: it is always
 * POSTER_WIDTH units wide, and its height follows from the chosen paper ratio.
 * Every layout number is expressed in these units. The preview scales the whole
 * thing to fit on screen; the exporters scale it to a physical size. Neither
 * affects the geometry.
 *
 * 1000 units wide was chosen so the port from the PoC is direct: 1cqw = 10u,
 * and an axis at "25%" sits at 250u.
 */
export const POSTER_WIDTH = 1000

/** 1cqw in the old system == 10 units in this one. */
export const CQW = POSTER_WIDTH / 100

export interface PaperSize {
  id: string
  label: string
  widthMm: number
  heightMm: number
}

const A2: PaperSize = { id: 'a2', label: 'A2 — 420 × 594 mm', widthMm: 420, heightMm: 594 }

export const PAPER_SIZES: readonly PaperSize[] = [
  A2,
  { id: 'a1', label: 'A1 — 594 × 841 mm', widthMm: 594, heightMm: 841 },
  { id: 'a0', label: 'A0 — 841 × 1189 mm', widthMm: 841, heightMm: 1189 },
  { id: 'tabloid', label: 'Tabloid — 279 × 432 mm', widthMm: 279.4, heightMm: 431.8 },
  { id: 'square', label: 'Square — 500 × 500 mm', widthMm: 500, heightMm: 500 },
  { id: 'story', label: 'Story 9:16 — 1080 × 1920 px', widthMm: 285.75, heightMm: 508 },
]

export const DEFAULT_PAPER: PaperSize = A2

export function paperById(id: string): PaperSize {
  return PAPER_SIZES.find((p) => p.id === id) ?? DEFAULT_PAPER
}

/** Poster height in coordinate units for a given paper ratio. */
export function posterHeight(paper: PaperSize): number {
  return (POSTER_WIDTH * paper.heightMm) / paper.widthMm
}

const MM_PER_INCH = 25.4
const PT_PER_INCH = 72

/** Physical size in PostScript points — the unit PDFs are authored in. */
export function paperSizePt(paper: PaperSize): { width: number; height: number } {
  return {
    width: (paper.widthMm / MM_PER_INCH) * PT_PER_INCH,
    height: (paper.heightMm / MM_PER_INCH) * PT_PER_INCH,
  }
}

/** Pixel dimensions for a raster export at a given dots-per-inch. */
export function paperSizePx(paper: PaperSize, dpi: number): { width: number; height: number } {
  return {
    width: Math.round((paper.widthMm / MM_PER_INCH) * dpi),
    height: Math.round((paper.heightMm / MM_PER_INCH) * dpi),
  }
}
