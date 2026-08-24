import type { ReactNode } from 'react'
import type { RenderContext } from '../context'
import { TYPE_SCALE } from '../context'
import type { LayoutId } from '../types'
import { CQW } from '../units'
import {
  BodyBlock,
  Cross,
  DisplayLine,
  GeoRect,
  GridLineH,
  GridLineV,
  bodyBlockHeight,
  displayAdvance,
} from './primitives'

/**
 * The five grid topologies, ported from the PoC.
 *
 * Each is a pure function of the render context. Where the PoC hard-coded
 * `w-[40%]` and `2cqw` against a container-query viewport, those become plain
 * arithmetic against the safe area, so the composition holds at any paper size
 * and survives export unchanged.
 *
 * Display type is fitted by measurement rather than by the old
 * `12 / titleLength` guess, so long titles shrink to fit instead of running off
 * the edge, and short ones fill the measure.
 */

export type LayoutRenderer = (ctx: RenderContext) => ReactNode

/** Standard inset used to hold copy off a grid line, as in the PoC. */
const PAD = 2 * CQW

function anchor(ctx: RenderContext): ReactNode {
  const { safe, state } = ctx
  const c = state.content
  const { v1, v2, h1, h2 } = state.physics.axes
  const right = safe.x + safe.width

  // Each title line is confined to the band it occupies: the first above h1,
  // the second between h1 and h2 where the body copy begins.
  const size0 = ctx.fitDisplayBox(c.title[0], safe.width, ctx.hy(h1) - safe.y, TYPE_SCALE.massive)
  const title1X = ctx.vx(v1)
  const title1Top = ctx.hy(h1) + CQW
  const size1 = ctx.fitDisplayBox(
    c.title[1],
    right - title1X,
    ctx.hy(h2) - title1Top,
    TYPE_SCALE.massive,
  )

  const bodyX = ctx.vx(v1) + PAD
  const bodyTop = ctx.hy(h2) + PAD
  // Stop the column short of v2 so it cannot run under the cross sitting there.
  const bodyWidth = Math.min(safe.width * 0.4, ctx.vx(v2) - bodyX - 5 * CQW)
  const bodyAvailable = safe.y + safe.height - bodyTop
  const payloadFont = ctx.body()
  const payloadHeight = bodyBlockHeight(c.payload, bodyWidth, payloadFont, bodyAvailable)

  return (
    <>
      <GridLineV ctx={ctx} percent={v1} />
      <GridLineV ctx={ctx} percent={v2} />
      <GridLineH ctx={ctx} percent={h1} />
      <GridLineH ctx={ctx} percent={h2} />

      <GeoRect ctx={ctx} x={right - 4 * CQW} y={ctx.hy(h2) - 10 * CQW} width={4 * CQW} height={4 * CQW} />

      <DisplayLine ctx={ctx} text={c.title[0]} x={safe.x} top={safe.y} size={size0} fill={ctx.ink} />
      <DisplayLine ctx={ctx} text={c.title[1]} x={title1X} top={title1Top} size={size1} fill={ctx.ink} />

      <Cross ctx={ctx} cx={ctx.vx(v2)} cy={ctx.hy(h2)} size={8 * CQW} />

      <BodyBlock
        ctx={ctx}
        text={c.payload}
        x={bodyX}
        top={bodyTop}
        width={bodyWidth}
        maxHeight={bodyAvailable}
        font={payloadFont}
        fill={ctx.mutedInk}
        uppercase
        bold
      />
      <BodyBlock
        ctx={ctx}
        text={c.desc}
        x={bodyX}
        top={bodyTop + payloadHeight + CQW}
        width={bodyWidth}
        maxHeight={bodyAvailable - payloadHeight - CQW}
        font={ctx.body()}
        fill={ctx.ink}
      />
    </>
  )
}

function matrix(ctx: RenderContext): ReactNode {
  const { safe, state } = ctx
  const c = state.content
  const { v1, v2, h1, h2 } = state.physics.axes

  const bandHeight = ctx.hy(h1) - safe.y
  const leftWidth = ctx.vx(v1) - safe.x
  const rightWidth = safe.x + safe.width - ctx.vx(v1)

  const titleTop = ctx.hy(h1) + CQW
  const titleWidth = safe.width - PAD * 2
  // Two lines share the band between h1 and where the payload sits at h2.
  const titleBand = Math.max(0, (ctx.hy(h2) - titleTop) / 2)
  const size0 = ctx.fitDisplayBox(c.title[0], titleWidth, titleBand, TYPE_SCALE.display)
  const size1 = ctx.fitDisplayBox(c.title[1], titleWidth, titleBand, TYPE_SCALE.display)

  return (
    <>
      <GridLineV ctx={ctx} percent={v1} />
      <GridLineV ctx={ctx} percent={v2} />
      <GridLineH ctx={ctx} percent={h1} />
      <GridLineH ctx={ctx} percent={h2} />

      <BodyBlock
        ctx={ctx}
        text={c.concept}
        x={safe.x + PAD}
        top={safe.y + PAD}
        width={Math.max(0, leftWidth - PAD * 2)}
        maxHeight={bandHeight - PAD * 2}
        font={ctx.body()}
        fill={ctx.ink}
        bold
      />
      <BodyBlock
        ctx={ctx}
        text={c.desc}
        x={ctx.vx(v1) + PAD}
        top={safe.y + PAD}
        width={Math.max(0, rightWidth - PAD * 2)}
        maxHeight={bandHeight - PAD * 2}
        font={ctx.body()}
        fill={ctx.mutedInk}
      />

      <DisplayLine ctx={ctx} text={c.title[0]} x={safe.x + PAD} top={titleTop} size={size0} fill={ctx.ink} />
      <DisplayLine
        ctx={ctx}
        text={c.title[1]}
        x={safe.x + PAD}
        top={titleTop + displayAdvance(ctx, size0)}
        size={size1}
        fill={ctx.ink}
      />

      <BodyBlock
        ctx={ctx}
        text={c.payload}
        x={ctx.vx(v1) + PAD}
        top={ctx.hy(h2) + PAD}
        width={safe.x + safe.width - ctx.vx(v1) - PAD}
        maxHeight={safe.y + safe.height - ctx.hy(h2) - PAD}
        font={ctx.mono()}
        fill={ctx.accent}
        uppercase
        bold
      />
    </>
  )
}

function brutalist(ctx: RenderContext): ReactNode {
  const { safe, state } = ctx
  const c = state.content
  const { v1, v2, v3, stagger } = state.physics.axes

  // Indent pattern from the PoC: 0, 1, 2, 1 steps of the stagger value.
  const steps = [0, 1, 2, 1]
  const indents = steps.map((s) => (s * stagger * safe.width) / 100)

  const descFont = ctx.body(4 * CQW)
  const descWidth = safe.width * 0.6
  const descMaxHeight = safe.height * 0.35
  const descHeight = bodyBlockHeight(c.desc, descWidth, descFont, descMaxHeight, 1.15)

  // Fit every line to the same size so the stack reads as one block, taking the
  // tightest of the four, then cap the whole stack to the room above the copy.
  const widthLimited = Math.min(
    ...c.stack.map((line, i) =>
      ctx.fitDisplay(line, safe.width - (indents[i] as number), TYPE_SCALE.stack),
    ),
  )
  const stackRoom = Math.max(0, safe.height - descHeight - CQW)
  const heightLimited = stackRoom / (c.stack.length * ctx.state.typography.leading * ctx.movement.titleStretchY)
  const size = Math.max(1, Math.min(widthLimited, heightLimited))
  const advance = displayAdvance(ctx, size)

  return (
    <>
      <GridLineV ctx={ctx} percent={v1} />
      <GridLineV ctx={ctx} percent={v2} />
      <GridLineV ctx={ctx} percent={v3} />

      {c.stack.map((line, i) => (
        <DisplayLine
          key={i}
          ctx={ctx}
          text={line}
          x={safe.x + (indents[i] as number)}
          top={safe.y + i * advance}
          size={size}
          fill={ctx.ink}
        />
      ))}

      <BodyBlock
        ctx={ctx}
        text={c.desc}
        x={ctx.vx(v1)}
        top={safe.y + safe.height - descHeight}
        width={descWidth}
        maxHeight={descMaxHeight}
        font={descFont}
        fill={ctx.mutedInk}
        leading={1.15}
      />
    </>
  )
}

function strictFourCol(ctx: RenderContext): ReactNode {
  const { safe, state } = ctx
  const c = state.content
  const { v1, v2, v3, h1, h2 } = state.physics.axes

  // The pair may cross the accent block, which sits behind them, but must stop
  // short of the copy at h2.
  const titleBand = Math.max(0, (ctx.hy(h2) - safe.y) / 2)
  const size0 = ctx.fitDisplayBox(c.title[0], safe.width, titleBand, TYPE_SCALE.massive)
  const size1 = ctx.fitDisplayBox(c.title[1], safe.width, titleBand, TYPE_SCALE.massive)

  const bodyX = ctx.vx(v1)
  const bodyTop = ctx.hy(h2) + PAD
  const bodyWidth = safe.width * 0.6
  const bodyAvailable = safe.y + safe.height - bodyTop
  const payloadFont = ctx.body()
  const payloadHeight = bodyBlockHeight(c.payload, bodyWidth, payloadFont, bodyAvailable)

  return (
    <>
      {/* Behind the type, as in the PoC. Axis ordering guarantees a positive extent. */}
      <GeoRect
        ctx={ctx}
        x={ctx.vx(v2)}
        y={ctx.hy(h1)}
        width={ctx.vx(v3) - ctx.vx(v2)}
        height={ctx.hy(h2) - ctx.hy(h1)}
      />

      <GridLineV ctx={ctx} percent={v1} />
      <GridLineV ctx={ctx} percent={v2} />
      <GridLineV ctx={ctx} percent={v3} />
      <GridLineH ctx={ctx} percent={h1} />
      <GridLineH ctx={ctx} percent={h2} />

      <DisplayLine ctx={ctx} text={c.title[0]} x={safe.x} top={safe.y} size={size0} fill={ctx.ink} />
      <DisplayLine
        ctx={ctx}
        text={c.title[1]}
        x={safe.x}
        top={safe.y + displayAdvance(ctx, size0)}
        size={size1}
        fill={ctx.ink}
      />

      <BodyBlock
        ctx={ctx}
        text={c.payload}
        x={bodyX}
        top={bodyTop}
        width={bodyWidth}
        maxHeight={bodyAvailable}
        font={payloadFont}
        fill={ctx.mutedInk}
        uppercase
        bold
      />
      <BodyBlock
        ctx={ctx}
        text={c.desc}
        x={bodyX}
        top={bodyTop + payloadHeight + CQW}
        width={bodyWidth}
        maxHeight={bodyAvailable - payloadHeight - CQW}
        font={ctx.body()}
        fill={ctx.ink}
      />
    </>
  )
}

function typeBlock(ctx: RenderContext): ReactNode {
  const { safe, state } = ctx
  const c = state.content
  const { v1, h1 } = state.physics.axes

  // The type may sit over the texture field, but not over the copy at the foot.
  const titleBand = safe.height * 0.25
  const titleSize0 = ctx.fitDisplayBox(c.title[0], safe.width, titleBand, 12 * CQW)
  const titleSize1 = ctx.fitDisplayBox(c.title[1], safe.width, titleBand, 12 * CQW)

  // A dense field of the meta token, used as texture rather than as reading copy.
  const token = c.meta.replace(/\s+/g, '').toUpperCase() || 'DATA'
  const field = `${token} `.repeat(60).trim()

  const fieldX = ctx.vx(v1) + PAD
  const fieldTop = ctx.hy(h1) + PAD

  const payloadFont = ctx.body()
  const payloadWidth = safe.width * 0.5
  const descFont = ctx.body()
  const descHeight = bodyBlockHeight(c.desc, payloadWidth, descFont, safe.height * 0.3)
  const payloadHeight = bodyBlockHeight(c.payload, payloadWidth, payloadFont, safe.height * 0.15)
  const blockTop = safe.y + safe.height - descHeight - payloadHeight - CQW

  return (
    <>
      <GridLineV ctx={ctx} percent={v1} />
      <GridLineH ctx={ctx} percent={h1} />

      <g opacity={0.2}>
        <BodyBlock
          ctx={ctx}
          text={field}
          x={fieldX}
          top={fieldTop}
          width={safe.width * 0.6}
          maxHeight={safe.height * 0.6}
          font={ctx.mono(1.5 * CQW)}
          fill={ctx.ink}
          leading={1.15}
        />
      </g>

      <DisplayLine ctx={ctx} text={c.title[0]} x={safe.x} top={safe.y} size={titleSize0} fill={ctx.ink} />
      <DisplayLine
        ctx={ctx}
        text={c.title[1]}
        x={safe.x}
        top={safe.y + displayAdvance(ctx, titleSize0)}
        size={titleSize1}
        fill={ctx.accent}
      />

      <BodyBlock
        ctx={ctx}
        text={c.payload}
        x={safe.x}
        top={blockTop}
        width={payloadWidth}
        maxHeight={safe.height * 0.15}
        font={payloadFont}
        fill={ctx.accent}
        uppercase
        bold
      />
      <BodyBlock
        ctx={ctx}
        text={c.desc}
        x={safe.x}
        top={blockTop + payloadHeight + CQW}
        width={payloadWidth}
        maxHeight={safe.height * 0.3}
        font={descFont}
        fill={ctx.ink}
      />
    </>
  )
}

export const LAYOUTS: Record<LayoutId, LayoutRenderer> = {
  anchor,
  matrix,
  brutalist,
  'strict-4-col': strictFourCol,
  'type-block': typeBlock,
}

export const LAYOUT_OPTIONS: readonly { id: LayoutId; label: string }[] = [
  { id: 'anchor', label: 'Anchor System' },
  { id: 'matrix', label: 'Data Matrix' },
  { id: 'brutalist', label: 'Brutalist Stack' },
  { id: 'strict-4-col', label: 'Strict 4-Col Grid' },
  { id: 'type-block', label: 'Typographic Block' },
]
