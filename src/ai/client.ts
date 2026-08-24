import { curate, rawPayloadSchema, type CuratedPayload } from './schema'

/**
 * Gemini client, using a key the user supplies.
 *
 * The PoC shipped `const apiKey = ""` with a note to paste one in before
 * exporting. Any key pasted there would be bundled into the built JavaScript
 * and readable by anyone who opened the page — on a public GitHub Pages site,
 * that is a key handed to the internet along with the bill.
 *
 * The site is static, so there is no server to hold a shared key. The honest
 * alternative is bring-your-own: the key lives in this browser's localStorage,
 * is never committed, never bundled, and never sent anywhere but Google's API.
 */

const STORAGE_KEY = 'poster-studio:gemini-key'
const DEFAULT_MODEL = 'gemini-2.5-flash'

export function loadApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim())
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable; the key simply will not persist across reloads.
  }
}

export class AiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiError'
  }
}

const SYSTEM_PROMPT = `You are an avant-garde art director composing a poster.

The user gives you a thematic concept. Respond with:
1. Brutalist, objective poster copy — terse, declarative, no marketing voice.
2. An art movement (styleMovement), chosen to suit the concept:
   - 'swiss'     orderly, clean, infrastructural
   - 'acid'      cyberpunk, hallucinatory, dark and neon
   - 'brutalism' punk, raw, rebellious
   - 'terminal'  code, data, pure technology
3. A layout (architectureLayout): 'anchor', 'matrix', 'brutalist', 'strict-4-col', or 'type-block'.
4. A hex palette suited to that movement. The ink must contrast strongly against
   the canvas — a poster is read from across a room.

Constraints that matter:
- 'title' must be exactly two lines. Keep each line short; these are set very large.
- 'stack' must be exactly four fragments that spell the concept when joined.
- 'desc' is at most two sentences.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    id: { type: 'STRING', description: 'Three-digit edition serial, e.g. 042' },
    concept: { type: 'STRING' },
    title: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Exactly two short lines, set very large',
    },
    stack: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Exactly four fragments that join to spell the concept',
    },
    payload: { type: 'STRING', description: 'Subtitle, a few words' },
    desc: { type: 'STRING', description: 'At most two sentences' },
    meta: { type: 'STRING', description: 'Short technical token, e.g. SECP256K1' },
    styleMovement: { type: 'STRING' },
    architectureLayout: { type: 'STRING' },
    colors: {
      type: 'OBJECT',
      properties: {
        bg: { type: 'STRING', description: 'Hex colour' },
        ink: { type: 'STRING', description: 'Hex colour, high contrast against bg' },
        accent: { type: 'STRING', description: 'Hex colour' },
      },
      required: ['bg', 'ink', 'accent'],
    },
  },
  required: [
    'id',
    'concept',
    'title',
    'stack',
    'payload',
    'desc',
    'meta',
    'styleMovement',
    'architectureLayout',
    'colors',
  ],
}

function describeHttpError(status: number, body: string): string {
  if (status === 400 && /API key not valid/i.test(body)) {
    return 'That API key was rejected. Check it in Settings.'
  }
  if (status === 403) return 'Access denied — the key may lack permission for this model.'
  if (status === 429) return 'Rate limited by the API. Wait a moment and try again.'
  if (status >= 500) return 'The API is having trouble. Try again shortly.'
  return `Request failed (${status}).`
}

export async function generateConcept(
  prompt: string,
  apiKey: string,
  signal?: AbortSignal,
  model: string = DEFAULT_MODEL,
): Promise<CuratedPayload> {
  if (!apiKey.trim()) {
    throw new AiError('No API key set. Add a Gemini key in Settings to generate concepts.')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      // The key travels in a header rather than the query string so it stays
      // out of browser history, referrers and any intermediary logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 1.1,
        },
      }),
      ...(signal ? { signal } : {}),
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new AiError('Could not reach the API. Check your network connection.')
  }

  if (!response.ok) {
    throw new AiError(describeHttpError(response.status, await response.text().catch(() => '')))
  }

  const result = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  }

  const candidate = result.candidates?.[0]
  const text = candidate?.content?.parts?.[0]?.text
  if (!text) {
    const reason = candidate?.finishReason
    throw new AiError(
      reason && reason !== 'STOP'
        ? `The model stopped early (${reason}). Try rephrasing the concept.`
        : 'The model returned an empty response. Try again.',
    )
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(text)
  } catch {
    throw new AiError('The model returned malformed JSON. Try again.')
  }

  const parsed = rawPayloadSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new AiError('The model response did not match the expected shape. Try again.')
  }

  return curate(parsed.data, prompt)
}
