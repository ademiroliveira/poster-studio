import { forwardRef } from 'react'
import type { RenderContext } from '../context'
import { buildContext } from '../context'
import type { PosterState } from '../types'
import { CQW } from '../units'
import { MONO_FAMILY } from '../movements'
import { LAYOUTS } from './layouts'

/**
 * The poster, as a single self-contained SVG.
 *
 * Self-contained matters: this exact element is what the exporters serialise,
 * so what is on screen and what lands in the PNG or PDF cannot drift apart.
 * That rules out `<foreignObject>` (browsers refuse to rasterise it) and rules
 * out anything that depends on ambient page CSS.
 */

const MICRO_SIZE = 2 * CQW

function Defs({ ctx }: { ctx: RenderContext }) {
  const { microGrid } = ctx.state.physics
  return (
    <defs>
      <filter id="geo-blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={ctx.movement.geoBlur} />
      </filter>

      <filter id="print-noise" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={3} stitchTiles="stitch" />
      </filter>

      {microGrid === 'blueprint' && (
        <pattern id="micro-grid" width={MICRO_SIZE} height={MICRO_SIZE} patternUnits="userSpaceOnUse">
          <path
            d={`M ${MICRO_SIZE} 0 L 0 0 0 ${MICRO_SIZE}`}
            fill="none"
            stroke={ctx.ink}
            strokeWidth={0.1 * CQW}
          />
        </pattern>
      )}
      {microGrid === 'dots' && (
        <pattern id="micro-grid" width={MICRO_SIZE} height={MICRO_SIZE} patternUnits="userSpaceOnUse">
          <circle cx={0.15 * CQW} cy={0.15 * CQW} r={0.15 * CQW} fill={ctx.ink} />
        </pattern>
      )}
    </defs>
  )
}

function Overlays({ ctx }: { ctx: RenderContext }) {
  const c = ctx.state.content
  const inset = 2 * CQW
  const right = ctx.width - inset

  return (
    <>
      <text
        x={right}
        y={inset + 1.5 * CQW}
        textAnchor="end"
        fontFamily={MONO_FAMILY}
        fontWeight={700}
        fontSize={1.5 * CQW}
        fill={ctx.mutedInk}
      >
        {`ID_${c.id}`.toUpperCase()}
      </text>
      <text
        x={right}
        y={inset + 3.2 * CQW}
        textAnchor="end"
        fontFamily={MONO_FAMILY}
        fontSize={1 * CQW}
        fill={ctx.mutedInk}
      >
        {c.meta}
      </text>

      {ctx.state.signature.trim() && (
        <text
          x={right}
          y={ctx.height - inset}
          textAnchor="end"
          fontFamily={MONO_FAMILY}
          fontWeight={700}
          fontSize={2 * CQW}
          fill={ctx.accent}
          style={{ mixBlendMode: 'difference' }}
        >
          {ctx.state.signature}
        </text>
      )}
    </>
  )
}

export interface PosterProps {
  state: PosterState
  className?: string
}

export const Poster = forwardRef<SVGSVGElement, PosterProps>(function Poster({ state, className }, ref) {
  const ctx = buildContext(state)
  const layout = LAYOUTS[state.architecture.layout]
  const { noise, microGrid } = state.physics

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${ctx.width} ${ctx.height}`}
      width={ctx.width}
      height={ctx.height}
      {...(className ? { className } : {})}
      role="img"
      aria-label={`Poster: ${state.content.title.join(' ')} — ${state.content.payload}`}
    >
      <Defs ctx={ctx} />

      <rect x={0} y={0} width={ctx.width} height={ctx.height} fill={ctx.bg} />

      {microGrid !== 'none' && (
        <rect
          x={0}
          y={0}
          width={ctx.width}
          height={ctx.height}
          fill="url(#micro-grid)"
          opacity={0.15}
        />
      )}

      {layout(ctx)}

      <Overlays ctx={ctx} />

      {noise > 0 && (
        <rect
          x={0}
          y={0}
          width={ctx.width}
          height={ctx.height}
          filter="url(#print-noise)"
          opacity={noise}
          style={{ mixBlendMode: 'multiply' }}
          pointerEvents="none"
        />
      )}
    </svg>
  )
})
