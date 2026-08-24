import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import monoUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url'
import groteskUrl from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url'
import serifUrl from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url'

/**
 * Fonts, embedded as data URIs for export.
 *
 * A serialised SVG is rendered in isolation — it has no access to the page's
 * stylesheets, and a rasteriser will not fetch a remote font before painting.
 * Any family that is not embedded silently falls back to a system default, so
 * the exported poster would not match the preview.
 *
 * This is also why the typefaces are bundled from npm rather than pulled from
 * the Google Fonts CDN as the PoC did, and why Brutalism no longer depends on
 * the viewer happening to have Times New Roman installed.
 */

interface EmbeddedFace {
  family: string
  url: string
  weightRange: string
  style: string
}

const FACES: readonly EmbeddedFace[] = [
  { family: 'Inter Variable', url: interUrl, weightRange: '100 900', style: 'normal' },
  { family: 'JetBrains Mono Variable', url: monoUrl, weightRange: '100 800', style: 'normal' },
  { family: 'Space Grotesk Variable', url: groteskUrl, weightRange: '300 700', style: 'normal' },
  { family: 'Instrument Serif', url: serifUrl, weightRange: '400', style: 'normal' },
]

async function toDataUri(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load font ${url}: ${response.status}`)
  const buffer = await response.arrayBuffer()

  // Chunked conversion; spreading a large buffer into String.fromCharCode
  // overflows the argument limit on bigger files.
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:font/woff2;base64,${btoa(binary)}`
}

let cached: Promise<string> | null = null

/** `@font-face` rules with every family inlined. Fetched once per session. */
export function embeddedFontCss(): Promise<string> {
  cached ??= (async () => {
    const rules = await Promise.all(
      FACES.map(async (face) => {
        const uri = await toDataUri(face.url)
        return [
          '@font-face {',
          `  font-family: '${face.family}';`,
          `  font-style: ${face.style};`,
          `  font-weight: ${face.weightRange};`,
          `  font-display: block;`,
          `  src: url('${uri}') format('woff2');`,
          '}',
        ].join('\n')
      }),
    )
    return rules.join('\n')
  })()
  return cached
}

/** Resolves once the browser has the families available for measurement. */
export async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return
  await document.fonts.ready
}
