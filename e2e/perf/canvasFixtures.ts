import { findBuiltInColor } from '../../src/domain/palette'
import { MARGIN } from '../../src/domain/margin'
import { framedGrid } from '../../src/domain/layerBeads'
import type { BeadMap, Rect } from '../../src/domain/canvas'
import type { Grid, Project } from '../../src/domain/project'
import type { Technique } from '../../src/domain/weave'
import { fixtureProject } from '../support/projects'

// The shapes the big-Canvas performance check opens (ticket 0673, "Canvas performance for large patterns"): many
// Pieces, one very large one, a Frame over a full Canvas, a big library, and the overlay's two whole-block cases.

const colorOf = (id: string) => findBuiltInColor(id)!.hex
/** Every Piece's ground: one color all its beads but a few share, so one Fill floods nearly all of it. The Paint
 * color the app starts on (black) is none of these, so every stroke bead is a change. */
const GROUND = colorOf('grey')
const ACCENTS = ['red', 'yellow', 'teal', 'purple'].map(colorOf)

/** The color of a patterned bead: the ground, with a lone accent bead here and there that never cuts the ground up. */
function patternColor(row: number, column: number): string {
  return (row * 7 + column * 3) % 23 === 0 ? ACCENTS[Math.abs(row + column) % ACCENTS.length]! : GROUND
}

/** Whether a patterned bead is the ground, which a Fill can start on. */
export function isGround(row: number, column: number): boolean {
  return patternColor(row, column) === GROUND
}

/** Paints a block of positions with the pattern, leaving out those `skip` names. */
function paint(beads: BeadMap, { row: top, column: left, rows, columns }: Rect, skip: (row: number, column: number) => boolean = () => false): BeadMap {
  for (let row = top; row < top + rows; row += 1) {
    for (let column = left; column < left + columns; column += 1) {
      if (skip(row, column)) continue
      beads[row] ??= {}
      beads[row]![column] = patternColor(row, column)
    }
  }
  return beads
}

/** A Project with these beads and nothing else: no Frame unless `frame` gives one. */
function projectWith(technique: Technique, id: string, changes: Partial<Project>, updatedAt: number): Project {
  const { frame: _none, ...base } = fixtureProject({ technique, columns: 1, rows: 1, blank: true })
  return { ...base, id, name: `Perf ${id}`, beads: {}, ...changes, updatedAt, createdAt: updatedAt }
}

/** A columns × rows patterned Frame at the Canvas's origin. */
function patternedFrame(technique: Technique, columns: number, rows: number): Pick<Project, 'frame'> {
  const grid: Grid = Array.from({ length: rows }, (_row, row) => Array.from({ length: columns }, (_cell, column) => ({ color: patternColor(row, column) })))
  return { frame: framedGrid(grid, { technique }).frame }
}

/** What a fixture is measured on (ticket 0673): a Paint stroke, panning, one Fill, Paste and Undo, hovering a Paste,
 * or dragging across a Piece-shaped Selection. */
export type Scenario = 'stroke' | 'pan' | 'edits' | 'paste hover' | 'shaped drag'

export interface CanvasFixture {
  name: string
  /** The library the app opens with; the first Project is the most recent, so it is the one open. */
  library: Project[]
  /** Canvas positions on the open Project that strokes, the Fill and the small Paste stay inside. */
  target: Rect
  scenarios: readonly Scenario[]
}

const SIDE = 300
const BIG: Rect = { row: 0, column: 0, rows: SIDE, columns: SIDE }
/** Well inside the 300 × 300 block, clear of its edge and of the Frame's margin. */
const INSIDE_BIG: Rect = { row: 100, column: 20, rows: 100, columns: SIDE - 40 }
const NOW = 1_700_000_000_000

/** The fixtures by name, in one Technique. */
export function canvasFixtures(technique: Technique): CanvasFixture[] {
  // 50 Pieces of 40 × 40, ten across and five down with 10 empty positions between, and no Frame.
  const scattered: BeadMap = {}
  for (let index = 0; index < 50; index += 1) {
    paint(scattered, { row: Math.floor(index / 10) * 50, column: (index % 10) * 50, rows: 40, columns: 40 })
  }
  const piece = projectWith(technique, 'piece', { beads: paint({}, BIG) }, NOW)
  const named = { ...piece, id: 'named-piece', pieceNames: [{ row: 0, column: 0, name: 'Big piece' }] }
  // The Canvas round the Frame, clear of it and its margin with two beads to spare: 420² less 312², about 79,000 beads.
  const clear = MARGIN + 2
  const ring: BeadMap = paint({}, { row: -60, column: -60, rows: SIDE + 120, columns: SIDE + 120 }, (row, column) => row >= -clear && row < SIDE + clear && column >= -clear && column < SIDE + clear)
  const framed = (id: string, updatedAt: number) => projectWith(technique, id, patternedFrame(technique, SIDE, SIDE), updatedAt)

  return [
    { name: 'scattered', library: [projectWith(technique, 'scattered', { beads: scattered }, NOW)], target: { row: 100, column: 250, rows: 40, columns: 40 }, scenarios: ['stroke', 'pan', 'edits'] },
    { name: 'piece', library: [piece], target: INSIDE_BIG, scenarios: ['stroke', 'pan', 'edits'] },
    { name: 'named piece', library: [named], target: INSIDE_BIG, scenarios: ['stroke', 'edits'] },
    { name: 'frame over canvas', library: [{ ...framed('frame', NOW), beads: ring }], target: INSIDE_BIG, scenarios: ['stroke', 'pan', 'edits'] },
    { name: 'library', library: Array.from({ length: 10 }, (_project, index) => framed(`library-${index}`, NOW - index * 1000)), target: INSIDE_BIG, scenarios: ['stroke', 'edits'] },
    { name: 'shaped selection', library: [piece], target: INSIDE_BIG, scenarios: ['shaped drag'] },
    { name: 'paste block', library: [piece], target: INSIDE_BIG, scenarios: ['paste hover'] },
  ]
}
