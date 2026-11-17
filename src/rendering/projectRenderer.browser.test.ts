import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { frameOf, heldWeave, withCanvas, withLayer } from '../domain/layerRecord'
import type { Project } from '../domain/project'
import type { Technique } from '../domain/weave'
import { moveToRow, rowProgressOf, stepLines, toggleRowDirection } from '../domain/rowProgress'
import { withLayers } from '../testUtils/layerFields'
import { DARK_THEME, type DrawingContext } from './beadLook'
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
