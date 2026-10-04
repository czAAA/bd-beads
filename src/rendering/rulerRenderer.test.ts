// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createPattern } from '../domain/pattern'
import { LIGHT_THEME, type DrawingContext } from './beadLook'
import { drawFrameEditing, drawRulers } from './rulerRenderer'

/** A context that writes down each rectangle drawn with `roundRect`, the style it was stroked or filled in and its text. */
function fakeContext() {
  const strokes: { style: unknown; rect: number[] }[] = []
  const fills: { style: unknown; rect: number[] }[] = []
  const texts: string[] = []
  let current: number[] = []
  const state = { strokeStyle: '', fillStyle: '' }
  const context = {
    setTransform: () => {},
    setLineDash: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    beginPath: () => {},
    fillRect: () => {},
    roundRect: (...args: number[]) => {
      current = args
    },
    stroke: () => strokes.push({ style: state.strokeStyle, rect: current }),
    fill: () => fills.push({ style: state.fillStyle, rect: current }),
    fillText: (text: string) => texts.push(text),
    set strokeStyle(value: string) {
      state.strokeStyle = value
    },
    set fillStyle(value: string) {
      state.fillStyle = value
    },
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as DrawingContext
  return { context, strokes, fills, texts }
}

const base = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const view = { technique: 'loom' as const, rotation: 0 as const, zoom: 1, scroll: { x: 0, y: 0 }, viewport: { width: 800, height: 600 }, fontPx: 11 }

describe('drawRulers', () => {
  const { frame: _frame, ...open } = base
  const twoPieces = { ...open, beads: withColors({}, [{ row: 0, column: 0, color: '#ff0000' }, { row: 10, column: 10, color: '#00ff00' }]) }

  it('draws a Piece\'s rectangle `muted` while it is being drawn, and the others `line-strong`', () => {
    const { context, strokes } = fakeContext()
    drawRulers(context, { pattern: twoPieces as typeof base, view, pixelRatio: 1, theme: LIGHT_THEME, showNumbers: false, activePiece: { row: 0, column: 0, rows: 1, columns: 1 } })

    expect(strokes.map((stroke) => stroke.style)).toEqual([LIGHT_THEME.pieceLineActive, LIGHT_THEME.pieceLine])
  })

  it('draws the Frame\'s line in `ink` and no Piece rectangles once there is a Frame', () => {
    const { context, strokes } = fakeContext()
    drawRulers(context, { pattern: base, view, pixelRatio: 1, theme: LIGHT_THEME, showNumbers: false })

    expect(strokes.map((stroke) => stroke.style)).toEqual([LIGHT_THEME.frameLine])
  })
})

describe('drawFrameEditing', () => {
  const frame = { row: 0, column: 0, rows: 3, columns: 3 }

  it('puts eight 9px handles round the Frame and the size tooltip at its corner', () => {
    const { context, strokes, fills, texts } = fakeContext()
    drawFrameEditing(context, { frame, view, pixelRatio: 1, theme: LIGHT_THEME, touch: false, tooltip: '3×3 · 0.5 × 0.5 cm' })

    expect(strokes).toHaveLength(8)
    expect(strokes.every((stroke) => stroke.rect[2] === 9 && stroke.rect[3] === 9)).toBe(true)
    expect(fills).toHaveLength(9)
    expect(texts).toEqual(['3×3 · 0.5 × 0.5 cm'])
  })

  it('draws no size tooltip when it is empty (the Rulers toggle is off)', () => {
    const { context, fills, texts } = fakeContext()
    drawFrameEditing(context, { frame, view, pixelRatio: 1, theme: LIGHT_THEME, touch: false, tooltip: '' })

    expect(fills).toHaveLength(8)
    expect(texts).toEqual([])
  })

  it('puts four 16px handles at the corners on touch', () => {
    const { context, strokes } = fakeContext()
    drawFrameEditing(context, { frame, view, pixelRatio: 1, theme: LIGHT_THEME, touch: true, tooltip: '' })

    expect(strokes).toHaveLength(4)
    expect(strokes.every((stroke) => stroke.rect[2] === 16 && stroke.rect[3] === 16)).toBe(true)
  })
})
