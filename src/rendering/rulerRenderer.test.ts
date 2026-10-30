// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { moveToRow, toggleRowDirection } from '../domain/rowProgress'
import { rotateFrame } from '../domain/rotate'
import { LIGHT_THEME, type DrawingContext } from './beadLook'
import { drawFrameEditing, drawRulers, type RulerDrawInput } from './rulerRenderer'
import { MARGIN_PX } from './marginSizes'
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
    // A path of points (a hot corner's bracket) is written down as the points it passes.
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

describe('the names under the Pieces (ADR 0066)', () => {
  const piece = (row: number, column: number) => [0, 1, 2].map((offset) => ({ row, column: column + offset, color: '#ff0000' }))
  const named = (framed: LayersChange) =>
    withLayers(base, {
      beads: withColors({}, [...piece(10, 10), ...piece(1, 0)]),
      pieceNames: [{ name: 'Sketch', row: 10, column: 10 }, { name: 'Hidden', row: 1, column: 0 }],
      ...framed,
    })

  it('draws the name of a Canvas Piece beside the Frame, and none under the Frame: its name is in the title block (ticket 0719)', () => {
    const { context, texts } = fakeContext()
    drawRulers(context, drawn(named({ frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, name: 'Cherry', beads: {} } }), { zoom: 1, numbers: false }))

    expect(texts).not.toContain('Cherry')
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

describe('the current pass\'s mark (MarginSheet and Rulers cards, ticket 0685)', () => {
  const marks = (fills: { style: unknown; rect: number[] }[]) => fills.filter((fill) => fill.style === LIGHT_THEME.marker)
  const holds = (rect: number[], point: { x: number; y: number }) => point.x > rect[0]! && point.x < rect[0]! + rect[2]! && point.y > rect[1]! && point.y < rect[1]! + rect[3]!
  const at = (project: RulerDrawInput['project'], sheet: 'full' | 'compact' | 'folded' | 'bare', { zoom = 1, numbers = true, rowMarks = true } = {}) => {
    const surface = surfaceAt(zoom)
    return { project, surface, layout: rulerLayout(project, surface, { fontPx: 11, numbers, sheet }), pixelRatio: 1, theme: LIGHT_THEME, rowMarks }
  }
  /** Where the Frame's line is on screen. */
  const lineOf = (input: ReturnType<typeof at>) => {
    const box = input.layout.boxes[0]!
    const shown = input.surface.beadBox(box, 'frame')
    return { left: shown.x - box.outset, top: shown.y - box.outset, right: shown.x + shown.width + box.outset }
  }

  it('sets the current row\'s numbers, left and right, on a `marker` pill in the canvas\'s ink, and draws no triangle', () => {
    const input = at(moveToRow(base, 1), 'full')
    const { context, fills, texts, textStyles } = fakeContext()
    drawRulers(context, input)

    const numbers = input.layout.labels.filter((label) => label.axis === 'row' && label.index === 1)
    expect(numbers).toHaveLength(2)
    expect(marks(fills)).toHaveLength(2)
    for (const number of numbers) expect(marks(fills).some((fill) => holds(fill.rect, number))).toBe(true)
    expect(textStyles.filter((_style, index) => texts[index] === '2')).toContain(LIGHT_THEME.canvas)
  })

  it('sets the current column\'s number in the top band on its pill once the rows run down the columns', () => {
    const input = at(moveToRow(toggleRowDirection(base), 1), 'full')
    const { context, fills } = fakeContext()
    drawRulers(context, input)

    const [number] = input.layout.labels.filter((label) => label.axis === 'column' && label.index === 1)
    expect(marks(fills)).toHaveLength(1)
    expect(holds(marks(fills)[0]!.rect, number!)).toBe(true)
  })

  it('marks nothing with the Row progress look off, nor once every pass is done', () => {
    const off = fakeContext()
    drawRulers(off.context, at(moveToRow(base, 1), 'full', { rowMarks: false }))
    expect(marks(off.fills)).toEqual([])
    expect(off.textStyles).not.toContain(LIGHT_THEME.canvas)

    const done = fakeContext()
    drawRulers(done.context, at(moveToRow(base, 3), 'compact'))
    expect(marks(done.fills)).toEqual([])
  })

  it.each(['compact', 'folded'] as const)('ticks the Frame\'s line at the current row on both sides in the %s form, inside the line', (sheet) => {
    const input = at(moveToRow(base, 1), sheet, { zoom: 0.5 })
    const { context, fills } = fakeContext()
    drawRulers(context, input)

    const row = input.surface.beadToPoint({ row: frameOf(base)!.row + 1, column: frameOf(base)!.column }, 'frame')
    const line = lineOf(input)
    const ticks = marks(fills)
    expect(ticks).toHaveLength(2)
    for (const [x, y, width, height] of ticks.map((tick) => tick.rect)) {
      expect(y! + height! / 2).toBeCloseTo(row.y)
      expect(height).toBe(MARGIN_PX.pass.tick)
      expect(x! < line.left + 1 || x! + width! > line.right - 1).toBe(true)
    }
    // Between the line and the beads, never out in the band where the tools stand.
    expect(ticks.map((tick) => tick.rect[0]!).sort((a, b) => a - b)[0]).toBeGreaterThanOrEqual(line.left - 1)
    expect(Math.max(...ticks.map((tick) => tick.rect[0]! + tick.rect[2]!))).toBeLessThanOrEqual(line.right + 1)
  })

  it('ticks the top of the Frame\'s line at the current column, inside the line, once the rows run down the columns', () => {
    const project = moveToRow(toggleRowDirection(base), 2)
    const input = at(project, 'compact', { zoom: 0.5 })
    const { context, fills } = fakeContext()
    drawRulers(context, input)

    const column = input.surface.beadToPoint({ row: frameOf(base)!.row, column: frameOf(base)!.column + 2 }, 'frame')
    const [tick, ...more] = marks(fills)
    expect(more).toEqual([])
    expect(tick!.rect[0]! + tick!.rect[2]! / 2).toBeCloseTo(column.x)
    expect(tick!.rect[1]).toBeGreaterThanOrEqual(lineOf(input).top - 1)
  })

  it('ticks the line where the full form shows no number of the pass: Rulers off, a Frame turned a quarter (ticket 0667), a Ruler step past it', () => {
    const off = fakeContext()
    drawRulers(off.context, at(moveToRow(base, 1), 'full', { numbers: false }))
    expect(marks(off.fills)).toHaveLength(2)
    expect(off.texts).not.toContain('2')

    const turned = fakeContext()
    drawRulers(turned.context, at(rotateFrame(moveToRow(base, 1))!, 'full'))
    expect(marks(turned.fills).map((fill) => fill.rect[2])).toEqual([MARGIN_PX.pass.tick])
    expect(turned.textStyles).not.toContain(LIGHT_THEME.canvas)

    // Under 50% only the last number is drawn: the second row has none of its own.
    const skipped = fakeContext()
    drawRulers(skipped.context, at(moveToRow(base, 1), 'full', { zoom: 0.3 }))
    expect(skipped.texts).not.toContain('2')
    expect(marks(skipped.fills)).toHaveLength(2)
  })

  it('marks nothing where the margin sheet is not, under a 31px band (ticket 0682)', () => {
    const { context, fills } = fakeContext()
    drawRulers(context, at(moveToRow(base, 1), 'bare', { zoom: 0.25 }))
    expect(marks(fills)).toEqual([])
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
