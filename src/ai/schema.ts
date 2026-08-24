import { z } from 'zod'
import { ensureLegible } from '../poster/color'
import type { ContentLayer, LayoutId, MovementId } from '../poster/types'

/**
 * Validation and repair of model output.
 *
 * The PoC did `JSON.parse(...)` and fed the result straight into the renderer,
 * indexing `title[1]` and `stack[3]` on faith. A model that returned three
 * syllables instead of four printed the literal word "undefined" onto the
 * poster, and an out-of-vocabulary movement name left the canvas unstyled.
 *
 * Everything crossing this boundary is treated as untrusted: parsed, then
 * coerced into shapes the renderer's types guarantee are safe. The aim is to
 * repair rather than reject — a slightly malformed response should still make a
 * poster, because failing a creative tool is worse than adjusting its input.
 */

const MOVEMENTS = ['swiss', 'acid', 'brutalism', 'terminal'] as const
const LAYOUTS = ['anchor', 'matrix', 'brutalist', 'strict-4-col', 'type-block'] as const

const hex = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/)
  .transform((v) => (v.startsWith('#') ? v : `#${v}`))

export const rawPayloadSchema = z.object({
  id: z.string().optional(),
  concept: z.string().optional(),
  title: z.array(z.string()).optional(),
  stack: z.array(z.string()).optional(),
  payload: z.string().optional(),
  desc: z.string().optional(),
  meta: z.string().optional(),
  styleMovement: z.string().optional(),
  architectureLayout: z.string().optional(),
  colors: z
    .object({ bg: hex.optional(), ink: hex.optional(), accent: hex.optional() })
    .partial()
    .optional(),
})

export type RawPayload = z.infer<typeof rawPayloadSchema>

export interface CuratedPayload {
  content: ContentLayer
  movement: MovementId
  layout: LayoutId
  colors: { bg: string; ink: string; accent: string }
  /** Adjustments made during repair, surfaced so the result is not silently altered. */
  notes: string[]
}

/** Split a word into `count` roughly equal chunks — a crude syllabifier. */
function chunk(word: string, count: number): string[] {
  const clean = word.replace(/\s+/g, '')
  if (!clean) return Array.from({ length: count }, () => '—')
  const size = Math.ceil(clean.length / count)
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    parts.push(clean.slice(i * size, (i + 1) * size) || clean.slice(-1))
  }
  return parts
}

function toTitle(input: string[] | undefined, fallback: string): [string, string] {
  const lines = (input ?? []).map((s) => s.trim()).filter(Boolean)
  if (lines.length >= 2) return [lines[0] as string, lines[1] as string]
  if (lines.length === 1) {
    const only = lines[0] as string
    const words = only.split(/\s+/)
    if (words.length >= 2) {
      const half = Math.ceil(words.length / 2)
      return [words.slice(0, half).join(' '), words.slice(half).join(' ')]
    }
    const [a, b] = chunk(only, 2)
    return [a as string, b as string]
  }
  const [a, b] = chunk(fallback, 2)
  return [a as string, b as string]
}

function toStack(input: string[] | undefined, title: [string, string]): [string, string, string, string] {
  const parts = (input ?? []).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 4) {
    return [parts[0] as string, parts[1] as string, parts[2] as string, parts[3] as string]
  }
  // Rebuild from the title rather than padding with blanks, so the brutalist
  // stack still reads as the poster's actual word.
  const source = parts.length > 0 ? parts.join('') : title.join('')
  const [a, b, c, d] = chunk(source, 4)
  return [a as string, b as string, c as string, d as string]
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const needle = (value ?? '').trim().toLowerCase()
  return allowed.find((a) => a === needle) ?? fallback
}

export function curate(raw: RawPayload, prompt: string): CuratedPayload {
  const notes: string[] = []

  const concept = (raw.concept?.trim() || prompt.trim() || 'CONCEPT').toUpperCase()
  const title = toTitle(raw.title, concept)
  if ((raw.title?.length ?? 0) !== 2) notes.push('Title reshaped to two lines.')

  const stack = toStack(raw.stack, title)
  if ((raw.stack?.length ?? 0) !== 4) notes.push('Stack rebuilt as four syllables.')

  const movement = oneOf(raw.styleMovement, MOVEMENTS, 'swiss')
  if (raw.styleMovement && movement !== raw.styleMovement.trim().toLowerCase()) {
    notes.push(`Unknown movement "${raw.styleMovement}" — fell back to Swiss.`)
  }

  const layout = oneOf(raw.architectureLayout, LAYOUTS, 'anchor')
  if (raw.architectureLayout && layout !== raw.architectureLayout.trim().toLowerCase()) {
    notes.push(`Unknown layout "${raw.architectureLayout}" — fell back to Anchor.`)
  }

  const bg = raw.colors?.bg ?? '#F4F4F4'
  const requestedInk = raw.colors?.ink ?? '#121212'
  const ink = ensureLegible(requestedInk, bg)
  if (ink !== requestedInk) {
    notes.push('Ink darkened for legibility against the canvas colour.')
  }

  // A 3-digit serial reads as a print edition number; models often return prose.
  const digits = (raw.id ?? '').replace(/\D/g, '').slice(0, 3)
  const id = digits.padStart(3, '0') || '001'

  return {
    content: {
      id,
      concept,
      title,
      stack,
      payload: raw.payload?.trim() || concept,
      desc: raw.desc?.trim() || 'No description returned.',
      meta: raw.meta?.trim() || 'UNTITLED',
    },
    movement,
    layout,
    colors: { bg, ink, accent: raw.colors?.accent ?? '#DE3824' },
    notes,
  }
}
