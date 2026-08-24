import { useState, type RefObject } from 'react'
import { AiError, generateConcept, loadApiKey, saveApiKey } from '../ai/client'
import { contrastRatio } from '../poster/color'
import { MOVEMENT_LIST } from '../poster/movements'
import { LAYOUT_OPTIONS } from '../poster/render/layouts'
import type { MicroGridStyle } from '../poster/types'
import { PAPER_SIZES, paperById } from '../poster/units'
import { ExportSizeError, exportPdf, exportPng, exportSvg, rasterDimensions } from '../export'
import type { Store } from '../state/store'
import { Alert, Button, ColorField, Group, Note, SelectField, SliderField, TextField } from './controls'

/**
 * The control panel.
 *
 * Tabs are a typed union rather than the PoC's stringly-typed ids — the bug
 * where the PHYSICS button dispatched `'phys'` at a panel called `'physics'`,
 * throwing and blanking the whole sidebar, is now a compile error.
 */

const TABS = [
  { id: 'concept', label: 'CONCEPT' },
  { id: 'style', label: 'STYLE' },
  { id: 'grid', label: 'GRID' },
  { id: 'type', label: 'TYPE' },
  { id: 'surface', label: 'SURFACE' },
  { id: 'export', label: 'EXPORT' },
] as const

type TabId = (typeof TABS)[number]['id']

const MICRO_GRID_OPTIONS: readonly { id: MicroGridStyle; label: string }[] = [
  { id: 'none', label: 'No micro-grid' },
  { id: 'blueprint', label: 'Blueprint matrix' },
  { id: 'dots', label: 'Technical dots' },
]

const DPI_OPTIONS = [
  { id: '150', label: '150 DPI — proof' },
  { id: '300', label: '300 DPI — print' },
  { id: '600', label: '600 DPI — fine art' },
] as const

export function Sidebar({ store, svgRef }: { store: Store; svgRef: RefObject<SVGSVGElement> }) {
  const [tab, setTab] = useState<TabId>('concept')

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-[#222] bg-[#0A0A0A]">
      <header className="flex items-center justify-between border-b border-[#222] p-5">
        <div>
          <h1 className="text-lg font-bold leading-tight tracking-tight text-white">POSTER STUDIO</h1>
          <p className="font-mono text-[9px] uppercase text-[#777]">Generative art direction</p>
        </div>
        <div className="flex gap-1">
          <HistoryButton label="Undo" disabled={!store.canUndo} onClick={() => store.dispatch({ type: 'undo' })}>
            ↶
          </HistoryButton>
          <HistoryButton label="Redo" disabled={!store.canRedo} onClick={() => store.dispatch({ type: 'redo' })}>
            ↷
          </HistoryButton>
        </div>
      </header>

      <nav className="flex border-b border-[#222] bg-[#111]" role="tablist" aria-label="Poster controls">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-2 py-3 font-mono text-[9px] font-bold transition-colors ${
              tab === t.id
                ? 'border-white bg-[#0A0A0A] text-white'
                : 'border-transparent text-[#666] hover:bg-[#1a1a1a] hover:text-[#aaa]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div id={`panel-${tab}`} role="tabpanel" className="no-scrollbar flex-1 overflow-y-auto">
        {tab === 'concept' && <ConceptTab store={store} />}
        {tab === 'style' && <StyleTab store={store} />}
        {tab === 'grid' && <GridTab store={store} />}
        {tab === 'type' && <TypeTab store={store} />}
        {tab === 'surface' && <SurfaceTab store={store} />}
        {tab === 'export' && <ExportTab store={store} svgRef={svgRef} />}
      </div>
    </aside>
  )
}

function HistoryButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: string
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'}${label === 'Redo' ? '⇧Z' : 'Z'})`}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded border border-[#2a2a2a] text-sm text-[#999] transition-colors hover:bg-[#1a1a1a] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function ConceptTab({ store }: { store: Store }) {
  const { state, dispatch } = store
  const [prompt, setPrompt] = useState('Zero Knowledge Proofs')
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [showKey, setShowKey] = useState(!loadApiKey())

  async function generate() {
    setBusy(true)
    setError(null)
    setNotes([])
    try {
      const result = await generateConcept(prompt, apiKey)
      dispatch({
        type: 'replace',
        value: {
          ...state,
          content: result.content,
          style: { movement: result.movement },
          architecture: { ...state.architecture, layout: result.layout },
          physics: { ...state.physics, ...result.colors },
        },
      })
      // Fresh coordinates for the new layout, exactly as the PoC did on load.
      dispatch({ type: 'reseed' })
      setNotes(result.notes)
    } catch (cause) {
      setError(cause instanceof AiError ? cause.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Group title="Semantic curator">
        <TextField label="Concept" value={prompt} onChange={setPrompt} placeholder="e.g. Cyberpunk, DeFi, Quantum" />
        <Button variant="primary" onClick={generate} busy={busy} disabled={!prompt.trim()}>
          {busy ? 'Curating…' : 'Synthesize concept'}
        </Button>

        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {notes.length > 0 && (
          <div className="mt-3">
            <Alert tone="info">
              <span className="mb-1 block font-mono text-[9px] uppercase text-[#666]">Adjusted on import</span>
              {notes.map((n) => (
                <span key={n} className="block">
                  • {n}
                </span>
              ))}
            </Alert>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          className="mt-3 font-mono text-[9px] uppercase text-[#666] underline-offset-2 hover:text-[#aaa] hover:underline"
        >
          {showKey ? 'Hide' : 'API key settings'}
        </button>

        {showKey && (
          <div className="mt-3 rounded border border-[#222] bg-[#0d0d0d] p-3">
            <TextField
              label="Gemini API key"
              type="password"
              mono
              value={apiKey}
              onChange={(v) => {
                setApiKey(v)
                saveApiKey(v)
              }}
              placeholder="AIza…"
            />
            <Note>
              Stored only in this browser, never sent anywhere but Google&apos;s API. This site is static, so
              there is no server to hold a shared key.
            </Note>
          </div>
        )}
      </Group>

      <Group title="Copy">
        <TextField label="Title line 1" value={state.content.title[0]} onChange={(v) => dispatch({ type: 'setTitleLine', index: 0, value: v })} />
        <TextField label="Title line 2" value={state.content.title[1]} onChange={(v) => dispatch({ type: 'setTitleLine', index: 1, value: v })} />
        <TextField label="Payload / subtitle" value={state.content.payload} onChange={(v) => dispatch({ type: 'setContent', key: 'payload', value: v })} />
        <TextField label="Description" value={state.content.desc} onChange={(v) => dispatch({ type: 'setContent', key: 'desc', value: v })} />
        <TextField label="Meta token" value={state.content.meta} onChange={(v) => dispatch({ type: 'setContent', key: 'meta', value: v })} />
        <TextField label="Edition serial" value={state.content.id} onChange={(v) => dispatch({ type: 'setContent', key: 'id', value: v })} />
        <TextField label="Signature mark" value={state.signature} onChange={(v) => dispatch({ type: 'setSignature', value: v })} />
      </Group>

      <Group title="Brutalist stack">
        <Note>Used by the Brutalist Stack layout — four fragments of the concept.</Note>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {state.content.stack.map((fragment, i) => (
            <input
              key={i}
              aria-label={`Stack fragment ${i + 1}`}
              className="w-full rounded border border-[#333] bg-[#111] px-2 py-1.5 text-center font-mono text-xs text-white outline-none focus:border-[#777]"
              value={fragment}
              onChange={(e) =>
                dispatch({ type: 'setStackLine', index: i as 0 | 1 | 2 | 3, value: e.target.value })
              }
            />
          ))}
        </div>
      </Group>
    </>
  )
}

function StyleTab({ store }: { store: Store }) {
  const { state, dispatch } = store
  return (
    <>
      <Group title="Design movement">
        <SelectField
          label="Movement"
          value={state.style.movement}
          options={MOVEMENT_LIST.map((m) => ({ id: m.id, label: m.label }))}
          onChange={(v) => dispatch({ type: 'setMovement', value: v })}
        />
        <Note>Each movement swaps the typeface, grid treatment, blending and geometry rules at once.</Note>
      </Group>

      <Group title="Format">
        <SelectField
          label="Paper size"
          value={state.paperId}
          options={PAPER_SIZES.map((p) => ({ id: p.id, label: p.label }))}
          onChange={(v) => dispatch({ type: 'setPaper', value: v })}
        />
        <Note>Layout is proportional, so changing format re-composes rather than crops.</Note>
      </Group>
    </>
  )
}

function GridTab({ store }: { store: Store }) {
  const { state, dispatch } = store
  const { axes } = state.physics
  const marginPinned = state.style.movement === 'brutalism'

  return (
    <>
      <Group title="Grid topology">
        <SelectField
          label="Layout"
          value={state.architecture.layout}
          options={LAYOUT_OPTIONS}
          onChange={(v) => dispatch({ type: 'setLayout', value: v })}
        />
        <Button onClick={() => dispatch({ type: 'reseed' })}>Snap coordinates</Button>
        <Note>
          Binds the grid to harmonic proportions. Seed{' '}
          <span className="font-mono text-[#aaa]">{state.architecture.seed}</span> — the same seed always
          reproduces this composition.
        </Note>
      </Group>

      <Group title="Safe area">
        <SliderField
          label="Master margin"
          value={state.physics.margin}
          min={0}
          max={15}
          step={0.5}
          disabled={marginPinned}
          onChange={(v) => dispatch({ type: 'setPhysicsNumber', key: 'margin', value: v })}
          format={(v) => `${v}%`}
          hint={marginPinned ? 'Brutalism bleeds to the edge and pins the margin at zero.' : undefined}
        />
      </Group>

      <Group title="Axis overrides">
        {(['v1', 'v2', 'v3'] as const).map((key, i) => (
          <SliderField
            key={key}
            label={`Vertical axis ${i + 1}`}
            value={axes[key]}
            min={0}
            max={100}
            step={1}
            onChange={(v) => dispatch({ type: 'setAxis', key, value: v })}
            format={(v) => `${v.toFixed(0)}%`}
          />
        ))}
        {(['h1', 'h2', 'h3'] as const).map((key, i) => (
          <SliderField
            key={key}
            label={`Horizontal axis ${i + 1}`}
            value={axes[key]}
            min={0}
            max={100}
            step={1}
            onChange={(v) => dispatch({ type: 'setAxis', key, value: v })}
            format={(v) => `${v.toFixed(0)}%`}
          />
        ))}
        <SliderField
          label="Stagger"
          value={axes.stagger}
          min={0}
          max={30}
          step={1}
          onChange={(v) => dispatch({ type: 'setAxis', key: 'stagger', value: v })}
          format={(v) => `${v.toFixed(0)}%`}
          hint="Per-line indent in the Brutalist Stack layout."
        />
        <Note>Axes stay in order — dragging one past its neighbour pushes the neighbour along.</Note>
      </Group>
    </>
  )
}

function TypeTab({ store }: { store: Store }) {
  const { state, dispatch } = store
  const t = state.typography
  return (
    <Group title="Typography">
      <SliderField
        label="Title scale"
        value={t.titleScale}
        min={0.5}
        max={1.5}
        step={0.05}
        onChange={(v) => dispatch({ type: 'setTypography', key: 'titleScale', value: v })}
        format={(v) => `${v.toFixed(2)}×`}
        hint="Titles are measured and shrunk to fit their column, so this is a ceiling rather than a fixed size."
      />
      <SliderField
        label="Tracking"
        value={t.tracking}
        min={-0.12}
        max={0.1}
        step={0.01}
        onChange={(v) => dispatch({ type: 'setTypography', key: 'tracking', value: v })}
        format={(v) => `${v.toFixed(2)}em`}
      />
      <SliderField
        label="Leading"
        value={t.leading}
        min={0.7}
        max={1.2}
        step={0.05}
        onChange={(v) => dispatch({ type: 'setTypography', key: 'leading', value: v })}
        format={(v) => v.toFixed(2)}
      />
    </Group>
  )
}

function SurfaceTab({ store }: { store: Store }) {
  const { state, dispatch } = store
  const p = state.physics
  const ratio = contrastRatio(p.ink, p.bg)

  return (
    <>
      <Group title="Palette">
        <div className="flex gap-3">
          <ColorField label="Canvas" value={p.bg} onChange={(v) => dispatch({ type: 'setPhysics', key: 'bg', value: v })} />
          <ColorField label="Ink" value={p.ink} onChange={(v) => dispatch({ type: 'setPhysics', key: 'ink', value: v })} />
          <ColorField label="Accent" value={p.accent} onChange={(v) => dispatch({ type: 'setPhysics', key: 'accent', value: v })} />
        </div>
        <div className="mt-3">
          {ratio < 3 ? (
            <Alert tone="error">
              Ink-to-canvas contrast is {ratio.toFixed(1)}:1. Below 3:1 the type stops reading at poster
              distance.
            </Alert>
          ) : (
            <Note>Ink-to-canvas contrast {ratio.toFixed(1)}:1.</Note>
          )}
        </div>
      </Group>

      <Group title="Micro-grid">
        <SelectField
          label="Background texture"
          value={p.microGrid}
          options={MICRO_GRID_OPTIONS}
          onChange={(v) => dispatch({ type: 'setPhysics', key: 'microGrid', value: v })}
        />
        <SliderField
          label="Structural line opacity"
          value={p.gridOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => dispatch({ type: 'setPhysicsNumber', key: 'gridOpacity', value: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </Group>

      <Group title="Print finish">
        <SliderField
          label="Grain density"
          value={p.noise}
          min={0}
          max={0.5}
          step={0.02}
          onChange={(v) => dispatch({ type: 'setPhysicsNumber', key: 'noise', value: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </Group>
    </>
  )
}

function ExportTab({ store, svgRef }: { store: Store; svgRef: RefObject<SVGSVGElement> }) {
  const { state } = store
  const [dpi, setDpi] = useState<'150' | '300' | '600'>('300')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const paper = paperById(state.paperId)
  const dpiValue = Number(dpi)
  const px = rasterDimensions(paper, dpiValue)
  const name = `${state.content.title.join('-')}-${state.content.id}`

  async function run(kind: string, fn: () => Promise<void>) {
    const svg = svgRef.current
    if (!svg) {
      setError('The poster has not finished rendering yet.')
      return
    }
    setBusy(kind)
    setError(null)
    try {
      await fn()
    } catch (cause) {
      setError(
        cause instanceof ExportSizeError
          ? cause.message
          : `Export failed: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Group title="Raster settings">
        <SelectField label="Resolution" value={dpi} options={DPI_OPTIONS} onChange={setDpi} />
        <Note>
          {paper.label.split('—')[0]?.trim()} at {dpiValue} DPI ={' '}
          <span className="font-mono text-[#aaa]">
            {px.width.toLocaleString()} × {px.height.toLocaleString()} px
          </span>
        </Note>
      </Group>

      <Group title="Download">
        <div className="space-y-2">
          <Button
            variant="primary"
            busy={busy === 'png'}
            disabled={busy !== null}
            onClick={() => run('png', () => exportPng(svgRef.current as SVGSVGElement, paper, dpiValue, name))}
          >
            PNG · {dpiValue} DPI
          </Button>
          <Button
            busy={busy === 'pdf'}
            disabled={busy !== null}
            onClick={() => run('pdf', () => exportPdf(svgRef.current as SVGSVGElement, paper, dpiValue, name))}
          >
            PDF · print ready
          </Button>
          <Button
            busy={busy === 'svg'}
            disabled={busy !== null}
            onClick={() => run('svg', () => exportSvg(svgRef.current as SVGSVGElement, name))}
          >
            SVG · vector
          </Button>
        </div>

        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
      </Group>

      <Group title="Which format">
        <Note>
          <strong className="text-[#bbb]">PNG</strong> renders exactly what you see, blend modes and grain
          included.
        </Note>
        <Note>
          <strong className="text-[#bbb]">PDF</strong> carries that raster on a page at the correct physical
          trim size — hand it to a printer.
        </Note>
        <Note>
          <strong className="text-[#bbb]">SVG</strong> is true vector with the fonts embedded. Open it in
          Illustrator or Figma to keep editing.
        </Note>
      </Group>
    </>
  )
}
