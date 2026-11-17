import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { frameOf, heldWeave, withCanvas, withLayer } from '../domain/layerRecord'
import type { Project } from '../domain/project'
import type { Technique } from '../domain/weave'
import { moveToRow, rowProgressOf, stepLines, toggleRowDirection } from '../domain/rowProgress'
import { withLayers } from '../testUtils/layerFields'
import { DARK_THEME, type DrawingContext } from './beadLook'
import { liftLookOf } from './liftedPiece'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'

// Drawing again only the rows an edit changed, for real, over what the last draw left: the picture must be the one a
// whole draw makes. A Lifted piece's contour and shadow reach past its bead's rows (ticket 1004), so a band cut to those
// rows alone left the beads next to an edit drawn in half.

type Cell = readonly [column: number, row: number]
const SIDE = 800
const PAINTED: readonly Cell[] = [[2, 2], [5, 4], [6, 4], [3, 7], [8, 8], [8, 9]]

function projectOf(technique: Technique, bead: string, cells: readonly Cell[]): Project {
  const made = withCanvas(createProject({ technique, beadId: bead, size: { width: 12, height: 12, unit: 'beads' } }), { orientation: 0 })
  const project = withLayer(made, 'frame', { weave: heldWeave(made, 'canvas') })
  return withLayers(project, { frame: { ...frameOf(project)!, beads: withColors({}, cells.map(([column, row]) => ({ row, column, color: '#222222' }))) } })
}

type Lines = { first: number; last: number }

function draw(project: Project, canvas: HTMLCanvasElement, rows?: Lines, more: { columns?: Lines; rowMarks?: boolean } = {}): void {
  const region = { x: -40, y: -40, width: SIDE / 2, height: SIDE / 2 }
  renderProject(canvas.getContext('2d') as unknown as DrawingContext, { project, space: spaceOf(project, true), region, zoom: 1, pixelRatio: 2, rowMarks: false, theme: DARK_THEME, rows, opaque: true, draftWhenSmall: true, ...more })
}

function surface(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIDE
  return canvas
}

/** The pixels that differ by more than an edge's antialiasing. */
function differing(one: HTMLCanvasElement, other: HTMLCanvasElement): number[] {
  const a = one.getContext('2d')!.getImageData(0, 0, SIDE, SIDE).data
  const b = other.getContext('2d')!.getImageData(0, 0, SIDE, SIDE).data
  const off: number[] = []
  for (let at = 0; at < a.length; at += 4) {
    if (Math.abs(a[at]! - b[at]!) + Math.abs(a[at + 1]! - b[at + 1]!) + Math.abs(a[at + 2]! - b[at + 2]!) > 48) off.push(at / 4)
  }
  return off
}

/** As many pixels as a contour's edges make where the band's clip crosses them: the browser antialiases a path cut by a
 * clip a little otherwise. A square bead's corners make a few; a round bead's curve two a device row for a few rows.
 * A bead drawn in half is hundreds. */
const CLIPPED_CORNERS_PX = 12

const edits: readonly [string, readonly Cell[], number][] = [
  ['painting under a bead', [...PAINTED, [2, 3]], 3],
  ['painting over a bead', [...PAINTED, [3, 6]], 6],
  ['painting apart', [...PAINTED, [10, 1]], 1],
  ['erasing the lower of two', PAINTED.filter(([column, row]) => !(column === 8 && row === 9)), 9],
  ['erasing the upper of two', PAINTED.filter(([column, row]) => !(column === 8 && row === 8)), 8],
]

describe.each(['toho-cube-1.5mm', 'toho-round-11-0'])('drawing again the row an edit changed, in %s', (bead) => {
  describe.each(['loom', 'peyote', 'brick'] as const)('%s', (technique) => {
    it.each(edits)('after %s, leaves the Canvas as a whole draw makes it', (_edit, after, row) => {
      const edited = projectOf(technique, bead, after)
      const whole = surface()
      draw(edited, whole)
      const banded = surface()
      draw(projectOf(technique, bead, PAINTED), banded)
      draw(edited, banded, { first: row, last: row })

      expect(differing(whole, banded).length).toBeLessThanOrEqual(CLIPPED_CORNERS_PX)
    })
  })
})

// A piece of many parts (ticket 1034) is filled a few parts a path and casts its shadows from one picture of itself:
// a band of it drawn again must leave the same picture too.
describe.each(['toho-cube-1.5mm', 'toho-round-11-0'])('drawing again a row of a checkered Frame, in %s', (bead) => {
  const CHECKERED: readonly Cell[] = Array.from({ length: 144 }, (_, at) => [at % 12, Math.floor(at / 12)] as const).filter(([column, row]) => (column + row) % 2 === 0)
  /** The clip crosses a contour's edge at every bead of the rows it cuts, not at a corner or two. */
  const CLIPPED_EDGES_PX = 3 * CLIPPED_CORNERS_PX

  it.each([
    ['painting between its beads', [...CHECKERED, [5, 6]] as readonly Cell[], 6],
    ['erasing one of its beads', CHECKERED.filter(([column, row]) => !(column === 6 && row === 6)), 6],
  ] as const)('after %s, leaves the Canvas as a whole draw makes it', (_edit, after, row) => {
    const edited = projectOf('loom', bead, after)
    const whole = surface()
    draw(edited, whole)
    const banded = surface()
    draw(projectOf('loom', bead, CHECKERED), banded)
    draw(edited, banded, { first: row, last: row })

    expect(differing(whole, banded).length).toBeLessThanOrEqual(CLIPPED_EDGES_PX)
  })
})

/** The color of the pixel whose red channel is at `at`, as hex. */
const hexAt = (data: Uint8ClampedArray, at: number) => `#${[data[at]!, data[at + 1]!, data[at + 2]!].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`

// A Piece's inner cuts (ticket 1035): a cut close to its beads is part of the piece, with no line of its own; a larger
// one keeps its line a bead further in. A cut an edit opens or closes is drawn again with the band, however far it runs.
describe.each(['toho-cube-1.5mm', 'toho-round-11-0'])('a Frame piece\'s inner cuts, in %s', (bead) => {
  const ring = (top: number, left: number, bottom: number, right: number): Cell[] => {
    const cells: Cell[] = []
    for (let row = top; row <= bottom; row += 1) for (let column = left; column <= right; column += 1) if (row === top || row === bottom || column === left || column === right) cells.push([column, row])
    return cells
  }
  /** A strip three beads wide down columns 4 to 6, rows 2 to 8, closed in: its middle lies a bead from the beads, lifted
   * only while the cut is closed (the rest is the piece's rim either way, ticket 1036). */
  const STRIP = ring(1, 3, 9, 7)
  const contour = liftLookOf(DARK_THEME.canvas).contour
  /** The pixels of the contour's color in a box of grid px. */
  const contourIn = (canvas: HTMLCanvasElement, left: number, top: number, right: number, bottom: number) => {
    const [x, y] = [(left + 40) * 2, (top + 40) * 2]
    const { data } = canvas.getContext('2d')!.getImageData(x, y, (right - left) * 2, (bottom - top) * 2)
    let found = 0
    for (let at = 0; at < data.length; at += 4) if (hexAt(data, at) === contour) found += 1
    return found
  }

  it('draws no line in a cut three beads wide, however long, and one once it is opened', () => {
    const canvas = surface()
    draw(projectOf('loom', bead, STRIP), canvas)
    expect(contourIn(canvas, 100, 40, 120, 180)).toBe(0)
    const open = surface()
    draw(projectOf('loom', bead, STRIP.filter(([column, row]) => !(column === 5 && row === 1))), open)
    expect(contourIn(open, 100, 40, 120, 180)).toBeGreaterThan(0)
  })

  it('keeps the line of a cut with a 2 × 2 block a bead in from its beads, a bead further in', () => {
    const canvas = surface()
    draw(projectOf('loom', bead, ring(2, 2, 9, 9)), canvas)
    // The cut is rows and columns 3 to 8: no line along its own edge, one along the open middle's, columns 4 to 7.
    expect(contourIn(canvas, 61, 100, 64, 120)).toBe(0)
    expect(contourIn(canvas, 81, 100, 84, 120)).toBeGreaterThan(0)
  })

  it.each([
    ['opening a cut far from the rows it runs down', STRIP, STRIP.filter(([column, row]) => !(column === 5 && row === 1)), 1],
    ['closing it again', STRIP.filter(([column, row]) => !(column === 5 && row === 1)), STRIP, 1],
  ] as const)('after %s, leaves the Canvas as a whole draw makes it', (_edit, before, after, row) => {
    const whole = surface()
    draw(projectOf('loom', bead, after), whole)
    const banded = surface()
    draw(projectOf('loom', bead, before), banded)
    draw(projectOf('loom', bead, after), banded, { first: row, last: row })
    expect(differing(whole, banded).length).toBeLessThanOrEqual(CLIPPED_CORNERS_PX)
  })
})

// On the open Canvas (ticket 1035): the tiles of a cut lifted with its piece are the Canvas's own, laid on the ground.
describe('a Canvas piece\'s inner cut', () => {
  it('shows the Canvas\'s tile in a cut of one bead, on the piece\'s ground, and no line', () => {
    const made = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
    const cells = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]].map(([row, column]) => ({ row: row! + 4, column: column! + 4, color: '#222222' }))
    const project = withLayers(made, { technique: 'loom', beads: withColors({}, cells), frame: undefined })
    const canvas = surface()
    draw(project, canvas)
    const look = liftLookOf(DARK_THEME.canvas)
    const pixel = (x: number, y: number) => {
      const { data } = canvas.getContext('2d')!.getImageData((x + 40) * 2, (y + 40) * 2, 1, 1)
      return hexAt(data, 0)
    }
    // The cut is row 5, column 5: its middle is a tile as the open Canvas's at row 12, column 12; its edge the ground.
    expect(pixel(110, 110)).toBe(pixel(250, 250))
    expect(pixel(110, 110)).not.toBe(look.ground)
    expect(pixel(100, 110)).toBe(look.ground)
    expect(pixel(102.9, 110)).not.toBe(look.contour)
  })
})

// A Progress bar step (ticket 1038) draws again only the lines of the passes whose look changed, a band of rows or, where
// the rows run down the Frame's columns, a strip of columns: the finished look, the current row and the Lifted piece's
// contour and shadow next to them must be as a whole draw makes them.
describe.each(['toho-cube-1.5mm', 'toho-round-11-0'])('drawing again the passes a Progress bar step changed, in %s', (bead) => {
  const CHECKERED: readonly Cell[] = Array.from({ length: 144 }, (_, at) => [at % 12, Math.floor(at / 12)] as const).filter(([column, row]) => (column + row) % 2 === 0)
  /** A step's cut has two edges, each crossing a bead of every line along it: the checkered Frame's allowance twice. */
  const CLIPPED_EDGES_PX = 2 * 3 * CLIPPED_CORNERS_PX

  describe.each(['loom', 'peyote', 'brick'] as const)('%s', (technique) => {
    it.each([
      ['Row done', 'rows', 5, 6],
      ['Row not done', 'rows', 6, 5],
      ['a press a few passes along', 'rows', 3, 7],
      ['Row done down the columns', 'columns', 5, 6],
    ] as const)('after %s, leaves the Canvas as a whole draw makes it', (_step, direction, from, to) => {
      const painted = projectOf(technique, bead, CHECKERED)
      const turned = direction === 'columns' ? toggleRowDirection(painted) : painted
      const [before, after] = [moveToRow(turned, from), moveToRow(turned, to)]
      const step = stepLines(after, rowProgressOf(before))!
      const offset = step.direction === 'rows' ? frameOf(after)!.row : frameOf(after)!.column
      const lines = { first: step.lines[0]! + offset, last: step.lines.at(-1)! + offset }
      const whole = surface()
      draw(after, whole, undefined, { rowMarks: true })
      const banded = surface()
      draw(before, banded, undefined, { rowMarks: true })
      if (step.direction === 'rows') draw(after, banded, lines, { rowMarks: true })
      else draw(after, banded, undefined, { columns: lines, rowMarks: true })

      expect(step.direction).toBe(direction)
      expect(differing(whole, banded).length).toBeLessThanOrEqual(CLIPPED_EDGES_PX)
    })
  })
})

// A Piece's rim (ticket 1036): its ground reaches one bead past its outer beads, with the Canvas's tiles on it, and the
// contour and shadow run at that edge. A band drawn again takes in the rim an edit moved, a row round it.
describe('a piece\'s rim', () => {
  /** A Project of the open Canvas alone, its beads at `cells`. */
  const canvasProject = (technique: Technique, bead: string, cells: readonly Cell[]) => {
    const made = createProject({ technique, beadId: bead, size: { width: 3, height: 3, unit: 'beads' } })
    return withLayers(made, { technique, beads: withColors({}, cells.map(([column, row]) => ({ row, column, color: '#222222' }))), frame: undefined })
  }
  const look = liftLookOf(DARK_THEME.canvas)
  const pixelOf = (canvas: HTMLCanvasElement) => (x: number, y: number) => hexAt(canvas.getContext('2d')!.getImageData((x + 40) * 2, (y + 40) * 2, 1, 1).data, 0)

  it('lays the ground a bead round a bead, the Canvas\'s tile on it, the contour past it', () => {
    const canvas = surface()
    draw(canvasProject('loom', 'toho-cube-1.5mm', [[5, 5]]), canvas)
    const pixel = pixelOf(canvas)
    // The bead is column 5, row 5 (x and y 100 to 120); the rim is x and y 80 to 140. Row 5, column 4's middle is a tile
    // as the open Canvas's far away; at the rim's outer edge, the ground.
    expect(pixel(90, 110)).toBe(pixel(250, 250))
    expect(pixel(80, 110)).toBe(look.ground)
    expect(pixel(140, 110)).toBe(look.ground)
    // The contour a few px outside the rim, none at the bead's own edge.
    const across = Array.from({ length: 12 }, (_, at) => pixel(70 + at, 110))
    expect(across).toContain(look.contour)
    expect(Array.from({ length: 10 }, (_, at) => pixel(95 + at * 0.5, 110))).not.toContain(look.contour)
  })

  it('gives two pieces two beads apart one ground between them, with no line in it', () => {
    const canvas = surface()
    draw(canvasProject('loom', 'toho-cube-1.5mm', [[3, 5], [6, 5]]), canvas)
    const pixel = pixelOf(canvas)
    // Columns 4 and 5 (x 80 to 120) are both pieces' rims.
    expect(Array.from({ length: 40 }, (_, at) => pixel(80 + at, 110))).not.toContain(look.contour)
    const apart = surface()
    draw(canvasProject('loom', 'toho-cube-1.5mm', [[3, 5], [7, 5]]), apart)
    expect(Array.from({ length: 60 }, (_, at) => pixelOf(apart)(80 + at, 110))).toContain(look.contour)
  })

  it('stops the rim at the Frame\'s edge: a bead on its edge has no ground past it', () => {
    // The Frame is the 12 × 12 Canvas; its beads at column 0 lie on its left edge, x 0.
    const canvas = surface()
    draw(projectOf('loom', 'toho-cube-1.5mm', [[0, 5], [0, 6]]), canvas)
    const pixel = pixelOf(canvas)
    // The rim is column 1, x 20 to 40: the ground at its outer edge.
    expect(pixel(40, 110)).toBe(look.ground)
    expect(pixel(-10, 110)).not.toBe(look.ground)
  })

  describe.each(['toho-cube-1.5mm', 'toho-round-11-0'])('in %s', (bead) => {
    describe.each(['loom', 'peyote', 'brick'] as const)('%s', (technique) => {
      it.each(edits)('after %s on the open Canvas, leaves it as a whole draw makes it', (_edit, after, row) => {
        const edited = canvasProject(technique, bead, after)
        const whole = surface()
        draw(edited, whole)
        const banded = surface()
        draw(canvasProject(technique, bead, PAINTED), banded)
        draw(edited, banded, { first: row, last: row })

        expect(differing(whole, banded).length).toBeLessThanOrEqual(CLIPPED_CORNERS_PX)
      })
    })
  })
})
