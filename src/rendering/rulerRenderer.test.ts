// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { moveToRow, toggleRowDirection } from '../domain/rowProgress'
import { rotateFrame } from '../domain/rotate'
import { LIGHT_THEME, type DrawingContext } from './beadLook'
import { drawFrameEditing, drawRulers, type RulerDrawInput } from './rulerRenderer'
import { rulerLayout } from './rulers'
import { OPEN_SPACE } from './space'
import { surfaceView } from './surfaceView'
import { frameOf, withFrameSheet } from '../domain/layerRecord'
import { type LayersChange, withLayers } from '../testUtils/layerFields'

/** A context that writes down each rectangle drawn with `roundRect`, the style it was stroked or filled in and its text. */
function fakeContext() {
  const strokes: { style: unknown; rect: number[] }[] = []
  const fills: { style: unknown; rect: number[] }[] = []
  const texts: string[] = []
  const textStyles: unknown[] = []
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
    // A path of points (a hot corner's bracket, the row pointer) is written down as the points it passes.
    moveTo: (x: number, y: number) => {
      current = [x, y]
    },
    lineTo: (x: number, y: number) => {
      current = [...current, x, y]
    },
    arcTo: (x: number, y: number) => {
      current = [...current, x, y]
    },
    closePath: () => {},
    fillRect: () => {},
    roundRect: (...args: number[]) => {
      current = args
    },
    stroke: () => strokes.push({ style: state.strokeStyle, rect: current }),
    fill: () => fills.push({ style: state.fillStyle, rect: current }),
    fillText: (text: string) => {
      texts.push(text)
      textStyles.push(state.fillStyle)
    },
    set strokeStyle(value: string) {
      state.strokeStyle = value
    },
    set fillStyle(value: string) {
      state.fillStyle = value
    },
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as DrawingContext
  return { context, strokes, fills, texts, textStyles }
}

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const surfaceAt = (zoom: number) => surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom, viewport: { width: 800, height: 600 } })

/** What the overlay hands drawRulers: the view's surface and the Ruler layout made for it. */
function drawn(project: RulerDrawInput['project'], { zoom, numbers }: { zoom: number; numbers: boolean }): Pick<RulerDrawInput, 'project' | 'surface' | 'layout' | 'pixelRatio' | 'theme' | 'rowMarks'> {
  const surface = surfaceAt(zoom)
  return { project, surface, layout: rulerLayout(project, surface, { fontPx: 11, numbers }), pixelRatio: 1, theme: LIGHT_THEME, rowMarks: false }
}

describe('drawRulers', () => {
  const open = withFrameSheet(base, undefined)
  const twoPieces = withLayers(open, { beads: withColors({}, [0, 1, 2].flatMap((row) => [0, 1, 2].flatMap((column) => [{ row, column, color: '#ff0000' }, { row: row + 10, column: column + 10, color: '#00ff00' }]))) })

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

  it('sets the Frame\'s numbers in the greys that read on its margin, and a Piece\'s in the Canvas\'s (ticket 0656)', () => {
    const theme = { ...LIGHT_THEME, margin: { ...LIGHT_THEME.margin, ruler: '#111111', rulerStrong: '#222222' } }
    const framed = fakeContext()
    drawRulers(framed.context, { ...drawn(withLayers(base, { frame: { ...frameOf(base)!, rows: 12, columns: 12 } }), { zoom: 1, numbers: true }), theme })
    expect(new Set(framed.textStyles)).toEqual(new Set(['#111111', '#222222']))

    const pieces = fakeContext()
    drawRulers(pieces.context, { ...drawn(twoPieces as typeof base, { zoom: 1, numbers: true }), theme })
    expect(pieces.textStyles.every((style) => style === LIGHT_THEME.ruler || style === LIGHT_THEME.rulerStrong)).toBe(true)
  })

  it('draws the Frame\'s line in `ink` and no Piece rectangles once there is a Frame', () => {
    const { context, strokes } = fakeContext()
    drawRulers(context, drawn(base, { zoom: 1, numbers: false }))

    expect(strokes.map((stroke) => stroke.style)).toEqual([LIGHT_THEME.frameLine])
  })
})

describe('the names under the Frame and the Pieces (ADR 0066)', () => {
  const piece = (row: number, column: number) => [0, 1, 2].map((offset) => ({ row, column: column + offset, color: '#ff0000' }))
  const named = (framed: LayersChange) =>
    withLayers(base, {
      beads: withColors({}, [...piece(10, 10), ...piece(1, 0)]),
      pieceNames: [{ name: 'Sketch', row: 10, column: 10 }, { name: 'Hidden', row: 1, column: 0 }],
      ...framed,
    })

  it('draws the Frame\'s name under it, and the name of a Canvas Piece beside it', () => {
    const { context, texts } = fakeContext()
    drawRulers(context, drawn(named({ frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, name: 'Cherry', beads: {} } }), { zoom: 1, numbers: false }))

    expect(texts).toContain('Cherry')
    expect(texts).toContain('Sketch')
  })

  it('leaves out the name of a Piece the Frame wholly covers', () => {
    const { context, texts } = fakeContext()
    drawRulers(context, drawn(named({ frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: {} } }), { zoom: 1, numbers: false }))

    expect(texts).toContain('Sketch')
    expect(texts).not.toContain('Hidden')
  })
})

describe('the Ruler dots', () => {
  const framed = withLayers(base, { frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 120, beads: {} } })
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

describe('the row pointer (MarginSheet card, ticket 0657)', () => {
  const pointers = (fills: { style: unknown; rect: number[] }[]) => fills.filter((fill) => fill.style === LIGHT_THEME.marker && fill.rect.length === 6)

  it('points at the current row from the left band, 4px outside the row numbers', () => {
    const project = moveToRow(base, 1)
    const input = { ...drawn(project, { zoom: 1, numbers: true }), rowMarks: true }
    const { context, fills } = fakeContext()
    drawRulers(context, input)

    const [pointer] = pointers(fills)
    const row = input.surface.beadToPoint({ row: frameOf(project)!.row + 1, column: frameOf(project)!.column }, 'frame')
    const numbersLeft = Math.min(...input.layout.labels.filter((label) => label.axis === 'row' && label.x < row.x).map((label) => label.x - label.width / 2))
    expect(pointer!.rect.slice(0, 2)).toEqual([numbersLeft - 4, row.y])
    expect(pointer!.rect.slice(2)).toEqual([numbersLeft - 13, row.y - 6, numbersLeft - 13, row.y + 6])
  })

  it('stands in the top band once the rows run down the columns, and goes with the Row progress look', () => {
    const project = moveToRow(toggleRowDirection(base), 1)
    const shown = fakeContext()
    drawRulers(shown.context, { ...drawn(project, { zoom: 1, numbers: true }), rowMarks: true })
    const [pointer] = pointers(shown.fills)
    // Pointing down: its tip below its base.
    expect(pointer!.rect[1]).toBeGreaterThan(pointer!.rect[3]!)

    const hidden = fakeContext()
    drawRulers(hidden.context, { ...drawn(project, { zoom: 1, numbers: true }), rowMarks: false })
    expect(pointers(hidden.fills)).toEqual([])
  })
  it('stands in the top band over a Frame turned a quarter, whose rows then run down (ticket 0667)', () => {
    const project = rotateFrame(moveToRow(base, 1))!
    const input = { ...drawn(project, { zoom: 1, numbers: true }), rowMarks: true }
    const { context, fills } = fakeContext()
    drawRulers(context, input)
    const [pointer] = pointers(fills)
    const row = input.surface.beadToPoint({ row: frameOf(project)!.row + 1, column: frameOf(project)!.column }, 'frame')
    // Pointing down at the turned row, from above it.
    expect(pointer!.rect[0]).toBeCloseTo(row.x)
    expect(pointer!.rect[1]).toBeGreaterThan(pointer!.rect[3]!)
  })
})

describe('drawFrameEditing (MarginSheet card, ticket 0657)', () => {
  const frame = { row: 0, column: 0, rows: 3, columns: 3 }
  const accent = (marks: { style: unknown; rect: number[] }[]) => marks.filter((mark) => mark.style === LIGHT_THEME.accent)

  it('draws an accent bracket at each corner of the Frame\'s line and a bar at each edge\'s middle, with the size tooltip', () => {
    const { context, strokes, fills, texts } = fakeContext()
    drawFrameEditing(context, { frame, surface: surfaceAt(1), pixelRatio: 1, theme: LIGHT_THEME, touch: false, tooltip: '3×3 ≈ 0.5 × 0.5 cm' })

    expect(accent(strokes)).toHaveLength(4)
    const bars = accent(fills)
    expect(bars).toHaveLength(4)
    expect(bars.map((bar) => [bar.rect[2], bar.rect[3]])).toEqual([[12, 4], [4, 12], [12, 4], [4, 12]])
    expect(texts).toEqual(['3×3 ≈ 0.5 × 0.5 cm'])
  })

  it('draws no size tooltip when it is empty (the Rulers toggle is off)', () => {
    const { context, fills, texts } = fakeContext()
    drawFrameEditing(context, { frame, surface: surfaceAt(1), pixelRatio: 1, theme: LIGHT_THEME, touch: false, tooltip: '' })

    expect(fills).toHaveLength(4)
    expect(texts).toEqual([])
  })

  it('draws the four corners alone on touch', () => {
    const { context, strokes, fills } = fakeContext()
    drawFrameEditing(context, { frame, surface: surfaceAt(1), pixelRatio: 1, theme: LIGHT_THEME, touch: true, tooltip: '' })

    expect(accent(strokes)).toHaveLength(4)
    expect(fills).toEqual([])
  })

  it('grows the corner under the pointer on a 32px disc, its arms 18px, and sets the size tooltip beside it', () => {
    const { context, strokes, fills } = fakeContext()
    const surface = surfaceAt(1)
    drawFrameEditing(context, { frame, surface, pixelRatio: 1, theme: LIGHT_THEME, touch: false, tooltip: '3×3 ≈ 0.5 × 0.5 cm', hot: 'bottom-right' })

    const box = surface.frameBox(frame)
    const corner = { x: box.x + box.width, y: box.y + box.height }
    const disc = fills.find((fill) => fill.rect.length === 5 && fill.rect[2] === 16)!
    expect(disc.rect.slice(0, 2)).toEqual([corner.x, corner.y])
    // The hot bracket: its arms run 18px from its corner, 5px outside the line (3px clear, half its 4px stroke).
    const hot = strokes.find((stroke) => stroke.rect.includes(corner.x + 5) && stroke.rect.includes(corner.y + 5 - 18))!
    expect(hot).toBeDefined()
    // The tooltip stands out from the Frame, right of and below the disc.
    const tip = fills.at(-1)!
    expect(tip.rect[0]).toBe(corner.x + 16)
    expect(tip.rect[1]).toBe(corner.y + 16)
  })
})
