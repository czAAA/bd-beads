// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/project'
import { LIGHT_THEME, type DrawingContext } from './beadLook'
import { drawFrameEditing, drawRulers, type RulerDrawInput } from './rulerRenderer'
import { rulerLayout } from './rulers'
import { OPEN_SPACE } from './space'
import { surfaceView } from './surfaceView'

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
    arc: (...args: number[]) => {
      current = args
    },
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

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const surfaceAt = (zoom: number) => surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom, viewport: { width: 800, height: 600 } })

/** What the overlay hands drawRulers: the view's surface and the Ruler layout made for it. */
function drawn(project: RulerDrawInput['project'], { zoom, numbers }: { zoom: number; numbers: boolean }): Pick<RulerDrawInput, 'project' | 'surface' | 'layout' | 'pixelRatio' | 'theme'> {
  const surface = surfaceAt(zoom)
  return { project, surface, layout: rulerLayout(project, surface, { fontPx: 11, numbers }), pixelRatio: 1, theme: LIGHT_THEME }
}

describe('drawRulers', () => {
  const { frame: _frame, ...open } = base
  const twoPieces = { ...open, beads: withColors({}, [0, 1, 2].flatMap((row) => [0, 1, 2].flatMap((column) => [{ row, column, color: '#ff0000' }, { row: row + 10, column: column + 10, color: '#00ff00' }]))) }

  it('draws every Piece rectangle `line-strong`, whichever Piece is being drawn', () => {
    const { context, strokes } = fakeContext()
    drawRulers(context, drawn(twoPieces as typeof base, { zoom: 1, numbers: true }))

    expect(strokes.map((stroke) => stroke.style)).toEqual([LIGHT_THEME.pieceLine, LIGHT_THEME.pieceLine])
  })

  it('draws no Piece rectangle with Rulers off, and both rectangles and numbers with Rulers on', () => {
    const off = fakeContext()
    drawRulers(off.context, drawn(twoPieces as typeof base, { zoom: 1, numbers: false }))
    expect(off.strokes).toHaveLength(0)
    expect(off.texts).toHaveLength(0)

    const on = fakeContext()
    drawRulers(on.context, drawn(twoPieces as typeof base, { zoom: 1, numbers: true }))
    expect(on.strokes).toHaveLength(2)
    expect(on.texts.length).toBeGreaterThan(0)
  })

  it('still draws the Frame\'s line with Rulers off', () => {
    const { context, strokes, texts } = fakeContext()
    drawRulers(context, drawn(base, { zoom: 1, numbers: false }))

    expect(strokes.map((stroke) => stroke.style)).toEqual([LIGHT_THEME.frameLine])
    expect(texts).toHaveLength(0)
  })

  it('draws the Frame\'s line in `ink` and no Piece rectangles once there is a Frame', () => {
    const { context, strokes } = fakeContext()
    drawRulers(context, drawn(base, { zoom: 1, numbers: false }))

    expect(strokes.map((stroke) => stroke.style)).toEqual([LIGHT_THEME.frameLine])
  })
})

describe('the Ruler dots', () => {
  const framed = { ...base, frame: { row: 0, column: 0, rows: 3, columns: 120 } }
  const radii = (fills: { rect: number[] }[]) => fills.filter((fill) => fill.rect.length === 5).map((fill) => fill.rect[2])

  it('draw a small dot for every bead without a number, in the number colours', () => {
    const { context, fills } = fakeContext()
    drawRulers(context, drawn(framed, { zoom: 0.7, numbers: true }))

    expect(new Set(radii(fills))).toEqual(new Set([1]))
    expect(fills.filter((fill) => fill.rect.length === 5).every((fill) => fill.style === LIGHT_THEME.ruler)).toBe(true)
  })

  it('draw only bolder 5th-bead dots under 6px of bead pitch', () => {
    const { context, fills } = fakeContext()
    drawRulers(context, drawn(framed, { zoom: 0.1, numbers: true }))

    expect(radii(fills).length).toBeGreaterThan(0)
    expect(new Set(radii(fills))).toEqual(new Set([1.75]))
  })

  it('draw none with Rulers off', () => {
    const { context, fills } = fakeContext()
    drawRulers(context, drawn(framed, { zoom: 0.7, numbers: false }))

    expect(radii(fills)).toEqual([])
  })
})

describe('drawFrameEditing', () => {
  const frame = { row: 0, column: 0, rows: 3, columns: 3 }

  it('puts eight 9px handles round the Frame and the size tooltip at its corner', () => {
    const { context, strokes, fills, texts } = fakeContext()
    drawFrameEditing(context, { frame, surface: surfaceAt(1), pixelRatio: 1, theme: LIGHT_THEME, touch: false, tooltip: '3×3 · 0.5 × 0.5 cm' })

    expect(strokes).toHaveLength(8)
    expect(strokes.every((stroke) => stroke.rect[2] === 9 && stroke.rect[3] === 9)).toBe(true)
    expect(fills).toHaveLength(9)
    expect(texts).toEqual(['3×3 · 0.5 × 0.5 cm'])
  })

  it('draws no size tooltip when it is empty (the Rulers toggle is off)', () => {
    const { context, fills, texts } = fakeContext()
    drawFrameEditing(context, { frame, surface: surfaceAt(1), pixelRatio: 1, theme: LIGHT_THEME, touch: false, tooltip: '' })

    expect(fills).toHaveLength(8)
    expect(texts).toEqual([])
  })

  it('puts four 16px handles at the corners on touch', () => {
    const { context, strokes } = fakeContext()
    drawFrameEditing(context, { frame, surface: surfaceAt(1), pixelRatio: 1, theme: LIGHT_THEME, touch: true, tooltip: '' })

    expect(strokes).toHaveLength(4)
    expect(strokes.every((stroke) => stroke.rect[2] === 16 && stroke.rect[3] === 16)).toBe(true)
  })
})
