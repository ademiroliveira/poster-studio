# Poster Studio

A generative poster tool. Pick a grid topology and an art movement, tune the
composition, and export something you can actually print.

Built from a single-file prototype (kept at
[`reference/poster_studio_v12.html`](reference/poster_studio_v12.html)) into a
typed, testable application with a real export pipeline.

## Running it

```bash
npm install
npm run dev
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | Types only |
| `npm test` | Unit tests |

## How it is put together

```
src/
  poster/          The poster itself — pure, no DOM, no app state
    units.ts       Coordinate system and paper sizes
    types.ts       The state model
    harmonics.ts   Seeded grid generation
    text.ts        Measurement, wrapping and fitting
    color.ts       Mixing and contrast
    context.ts     State resolved into everything a layout needs
    render/        SVG primitives, the five layouts, the poster root
  state/           Store with undo/redo and persistence
  export/          SVG, PNG and PDF output
  ui/              Control panel
```

The single idea everything else follows from: **the poster is a pure function
of a plain serialisable value, rendered as one self-contained SVG.** Because it
never reads the DOM or ambient CSS, the same code drives the preview and every
export, so they cannot disagree.

### The coordinate system

The prototype laid out in `cqw`/`cqh` container-query units, which made the
geometry a function of the browser window. That is why it could not export — at
300dpi there is no window to measure against — and why the poster's proportions
drifted as the window changed shape.

Here the poster owns its own space: always `1000` units wide, with height from
the paper ratio. The preview scales it to fit; the exporters scale it to a
physical size. Neither changes the design.

### Grids are generated, not remembered

Axis positions derive from `(layout, seed)`. The same seed always reproduces the
same composition, so a poster is fully described by its state — shareable, and
undoable. Generation always returns a *complete* axis set, which is what stops
values from one layout leaking into the next.

Axes are held in ascending order with a minimum gap. That invariant is what
makes negative-width geometry impossible rather than merely unlikely, and it is
covered by tests in [`harmonics.test.ts`](src/poster/harmonics.test.ts).

### Text

SVG does not wrap text, and `<foreignObject>` — the obvious way out — is refused
by browsers when rasterising and unsupported by SVG-to-PDF tooling. So the app
measures and breaks its own copy against a real 2D context, and clamps it to the
space available instead of letting it bleed off the canvas.

Display type is fitted by measurement rather than estimated from character
count, and confined to the band it sits in, so titles neither overflow their
column nor land on top of the copy below.

### Fonts

Bundled from npm, not fetched from a CDN. A serialised SVG has no access to the
page's stylesheets and a rasteriser will not wait for a remote font, so any
family that is not embedded silently falls back — and the export would not match
what you designed. Bundling also means Brutalism no longer depends on the viewer
happening to have Times New Roman installed.

## Export

| Format | What it is | Use it when |
| --- | --- | --- |
| **SVG** | True vector, fonts embedded | You want to keep editing in Illustrator or Figma |
| **PNG** | Exact pixels at 150/300/600 DPI | You want precisely what you see, grain and blend modes included |
| **PDF** | Correct physical trim size | You are handing it to a printer |

The PDF carries a high-DPI raster rather than vector text. Embedding a variable
woff2 into a PDF means converting glyphs to outlines, and SVG-to-PDF libraries
that skip that step quietly substitute a base-14 font — which would print the
poster in the wrong typeface. A raster at the exact trim size prints correctly
and never lies about the design. Reach for the SVG export when you need vector.

Large formats at high DPI can exceed what a browser canvas will allocate; the
app checks before starting and tells you to drop the DPI rather than failing
part-way.

## AI generation

Optional, and bring-your-own-key. The site is static, so there is no server to
hold a shared key — a key baked into the bundle would be readable by anyone who
opened the page. Yours is stored in your browser's localStorage, never
committed, never bundled, and sent only to Google's API.

Get a key from [Google AI Studio](https://aistudio.google.com/apikey), then paste
it under **Concept → API key settings**.

Model output is treated as untrusted: parsed, validated, and repaired into
shapes the renderer guarantees are safe. A response with three syllables instead
of four gets reshaped rather than printing the word "undefined" onto the poster,
and a palette without enough contrast is corrected. Any repair is reported in
the panel rather than applied silently.

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Enable it once
under **Settings → Pages → Source → GitHub Actions**. The workflow sets
`BASE_PATH` from the repository name, so project-site asset paths resolve
without any local configuration.

## Known limits

- Built for a desktop viewport; usable but cramped below roughly 1100px.
- The PDF is raster-backed (see above).
- Print grain is an SVG filter, so it survives PNG and PDF export but is dropped
  if you open the SVG in an editor that does not evaluate filters.
- Latin character sets only.
