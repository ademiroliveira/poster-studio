import type { PaperSize } from '../poster/units'
import { paperSizePt, paperSizePx } from '../poster/units'
import { embeddedFontCss } from './fonts'

/**
 * Export pipeline.
 *
 * The PoC had none — a poster studio that could not produce a poster. All three
 * formats here serialise the very same live SVG element, so nothing can drift
 * between what is previewed and what is delivered.
 *
 * Format trade-offs, deliberately:
 *   SVG — true vector, editable in Illustrator or Figma, fonts embedded.
 *   PNG — exact pixels at a chosen DPI. Blend modes and grain render faithfully.
 *   PDF — correct physical page size for print, carrying a high-DPI raster.
 *
 * The PDF is raster-backed rather than vector because embedding a variable
 * woff2 into a PDF requires converting glyphs to outlines, and every SVG-to-PDF
 * library that skips that step substitutes one of the base-14 fonts — which
 * would silently print the poster in the wrong typeface. A 300dpi raster at the
 * exact trim size prints correctly and never lies about the design. Use the SVG
 * export when true vector output is required.
 */

/** Chrome refuses canvases beyond this on any single axis. */
const MAX_DIMENSION = 16384
/** Total pixel budget; beyond this allocation tends to fail rather than throw. */
const MAX_PIXELS = 120_000_000

export class ExportSizeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportSizeError'
  }
}

export function checkRasterSize(paper: PaperSize, dpi: number): void {
  const { width, height } = paperSizePx(paper, dpi)
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ExportSizeError(
      `${paper.label} at ${dpi} DPI is ${width}×${height}px, past the ${MAX_DIMENSION}px browser canvas limit. Try a lower DPI.`,
    )
  }
  if (width * height > MAX_PIXELS) {
    throw new ExportSizeError(
      `${paper.label} at ${dpi} DPI is ${Math.round((width * height) / 1e6)} megapixels, too large to render in the browser. Try a lower DPI.`,
    )
  }
}

/** Estimated raster dimensions, for showing the user before they commit. */
export function rasterDimensions(paper: PaperSize, dpi: number): { width: number; height: number } {
  return paperSizePx(paper, dpi)
}

/**
 * Clone the poster and make it stand alone: explicit namespace, explicit
 * dimensions, and fonts inlined so no external fetch is needed to paint it.
 */
async function serialize(svg: SVGSVGElement, width: number, height: number): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.removeAttribute('class')

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = await embeddedFontCss()
  clone.insertBefore(style, clone.firstChild)

  return new XMLSerializer().serializeToString(clone)
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking synchronously can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'poster'
  )
}

/** Rasterise the poster to a canvas at an explicit pixel size. */
async function rasterize(
  svg: SVGSVGElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const markup = await serialize(svg, width, height)
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const image = new Image()
    image.decoding = 'sync'
    image.src = url
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not acquire a 2D context for export')

    ctx.drawImage(image, 0, 0, width, height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))),
      type,
      quality,
    )
  })
}

export async function exportSvg(svg: SVGSVGElement, name: string): Promise<void> {
  const width = Number(svg.getAttribute('width')) || 1000
  const height = Number(svg.getAttribute('height')) || 1414
  const markup = await serialize(svg, width, height)
  download(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${slugify(name)}.svg`)
}

export async function exportPng(
  svg: SVGSVGElement,
  paper: PaperSize,
  dpi: number,
  name: string,
): Promise<void> {
  checkRasterSize(paper, dpi)
  const { width, height } = paperSizePx(paper, dpi)
  const canvas = await rasterize(svg, width, height)
  download(await canvasToBlob(canvas, 'image/png'), `${slugify(name)}-${dpi}dpi.png`)
}

export async function exportPdf(
  svg: SVGSVGElement,
  paper: PaperSize,
  dpi: number,
  name: string,
): Promise<void> {
  checkRasterSize(paper, dpi)
  const px = paperSizePx(paper, dpi)
  const pt = paperSizePt(paper)

  const canvas = await rasterize(svg, px.width, px.height)
  // JPEG at high quality keeps the file openable; a 300dpi A1 PNG can exceed
  // the practical limit for a data URI inside a PDF.
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95)

  // Loaded on demand. jsPDF pulls in html2canvas and dompurify for a feature
  // this app never uses, and bundling that eagerly would cost every visitor
  // roughly 400kB for a button most of them will not press.
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    unit: 'pt',
    format: [pt.width, pt.height],
    orientation: pt.width > pt.height ? 'landscape' : 'portrait',
    compress: true,
  })
  doc.addImage(dataUrl, 'JPEG', 0, 0, pt.width, pt.height, undefined, 'FAST')
  doc.save(`${slugify(name)}.pdf`)
}
