import type { ReactNode } from 'react'
import type { RenderContext } from '../context'
import type { FontSpec } from '../text'
import { wrapClamped } from '../text'

/**
 * Shared SVG building blocks.
 *
 * Two things are worth knowing when reading the layouts:
 *
 * - SVG positions text by its *baseline*, but designers position display type
 *   by the top of its capitals. Every helper here takes a `top` and converts,
 *   using CAP_HEIGHT as the cap-height ratio, so layout maths reads naturally.
 *
 * - Nothing wraps on its own. `BodyBlock` measures and breaks copy explicitly,
 *   and clamps it to the space available instead of letting it bleed off the
 *   poster the way the PoC did.
 */

/** Cap height as a fraction of font size — close enough across our families. */
const CAP_HEIGHT = 0.72

export function GridLineV({ ctx, percent }: { ctx: RenderContext; percent: number }): ReactNode {
  if (ctx.movement.gridThickness <= 0) return null
  const x = ctx.vx(percent)
  return (
    <line
      x1={x}
      y1={ctx.safe.y}
      x2={x}
      y2={ctx.safe.y + ctx.safe.height}
      stroke={ctx.gridColor}
      strokeWidth={ctx.movement.gridThickness}
      {...(ctx.movement.gridDash ? { strokeDasharray: ctx.movement.gridDash } : {})}
    />
  )
}

export function GridLineH({ ctx, percent }: { ctx: RenderContext; percent: number }): ReactNode {
  if (ctx.movement.gridThickness <= 0) return null
  const y = ctx.hy(percent)
  return (
    <line
      x1={ctx.safe.x}
      y1={y}
      x2={ctx.safe.x + ctx.safe.width}
      y2={y}
      stroke={ctx.gridColor}
      strokeWidth={ctx.movement.gridThickness}
      {...(ctx.movement.gridDash ? { strokeDasharray: ctx.movement.gridDash } : {})}
    />
  )
}

interface DisplayLineProps {
  ctx: RenderContext
  text: string
  x: number
  /** Top of the capitals, not the baseline. */
  top: number
  size: number
  fill: string
}

/**
 * One line of display type, honouring the movement's stretch.
 *
 * The stretch transform is anchored at the top-left rather than the baseline so
 * that Acid's vertical stretch grows downward into empty space, instead of
 * upward into whatever sits above it.
 */
export function DisplayLine({ ctx, text, x, top, size, fill }: DisplayLineProps): ReactNode {
  const { titleStretchX: sx, titleStretchY: sy } = ctx.movement
  const font = ctx.display(size)
  return (
    <g transform={`translate(${x}, ${top}) scale(${sx}, ${sy})`}>
      <text
        x={0}
        y={size * CAP_HEIGHT}
        fill={fill}
        fontFamily={font.family}
        fontWeight={font.weight}
        fontSize={size}
        letterSpacing={font.tracking * size}
        xmlSpace="preserve"
      >
        {text.toUpperCase()}
      </text>
    </g>
  )
}

/** Vertical advance for stacked display lines, accounting for vertical stretch. */
export function displayAdvance(ctx: RenderContext, size: number): number {
  return ctx.lineHeight(size) * ctx.movement.titleStretchY
}

interface BodyBlockProps {
  ctx: RenderContext
  text: string
  x: number
  top: number
  width: number
  maxHeight: number
  font: FontSpec
  fill: string
  /** Line height multiplier; body copy wants more air than display type. */
  leading?: number
  uppercase?: boolean
  bold?: boolean
}

export function BodyBlock({
  text,
  x,
  top,
  width,
  maxHeight,
  font,
  fill,
  leading = 1.3,
  uppercase = false,
  bold = false,
}: BodyBlockProps): ReactNode {
  const spec: FontSpec = bold ? { ...font, weight: 700 } : font
  const content = uppercase ? text.toUpperCase() : text
  const advance = spec.size * leading
  const lines = wrapClamped(content, width, spec, advance, maxHeight)
  if (lines.length === 0) return null

  return (
    <text
      x={x}
      y={top + spec.size * CAP_HEIGHT}
      fill={fill}
      fontFamily={spec.family}
      fontWeight={spec.weight}
      fontSize={spec.size}
      {...(spec.tracking ? { letterSpacing: spec.tracking * spec.size } : {})}
      xmlSpace="preserve"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} {...(i > 0 ? { dy: advance } : {})}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

/** Height a BodyBlock will occupy, for layouts that need to stack blocks. */
export function bodyBlockHeight(
  text: string,
  width: number,
  font: FontSpec,
  maxHeight: number,
  leading = 1.3,
): number {
  const advance = font.size * leading
  return wrapClamped(text, width, font, advance, maxHeight).length * advance
}

export function Cross({
  ctx,
  cx,
  cy,
  size,
}: {
  ctx: RenderContext
  cx: number
  cy: number
  size: number
}): ReactNode {
  const arm = size / 2
  const bar = size / 4
  return (
    <g style={{ mixBlendMode: ctx.movement.blendMode }} filter="url(#geo-blur)">
      <rect x={cx - arm} y={cy - bar / 2} width={size} height={bar} fill={ctx.ink} />
      <rect x={cx - bar / 2} y={cy - arm} width={bar} height={size} fill={ctx.ink} />
    </g>
  )
}

export function GeoRect({
  ctx,
  x,
  y,
  width,
  height,
}: {
  ctx: RenderContext
  x: number
  y: number
  width: number
  height: number
}): ReactNode {
  // Extents are derived from ordered axes, but guard anyway — a negative width
  // is an invalid SVG attribute and the element silently vanishes.
  if (width <= 0 || height <= 0) return null
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={ctx.accent}
      style={{ mixBlendMode: ctx.movement.blendMode }}
      filter="url(#geo-blur)"
    />
  )
}
