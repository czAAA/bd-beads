import type { FrameSheet } from './canvas'
import { keyOf } from './frameLayout'
import { frameLayoutOf, settingsOf, type FrameShapeId } from './frameShape'
import type { GridPosition } from './grid'

/** A Frame that is one face of a larger piece (ticket 0876): the faces the piece has, the parts one face shows and the
 * parts of the whole piece. Its counts are the face's; the piece's are the face's times its faces, and the beads that
 * join its parts (ticket 0877). */
export interface PieceFace {
  faces: number
  parts: number
  total: number
}

/** The beads a piece's joins add, by the beads a side of its parts (ticket 0877): its Edge Beads and Hinge Beads, of the
 * face's bead, and its Triangle Tips and Hinge Pins, 15/0 rocailles, a smaller bead. */
interface JoinBeads {
  id: 'edgeBeads' | 'hingeBeads' | 'tips' | 'hingePins'
  count: number
  /** Its own bead size where it is not the face's bead: a 15/0 rocaille. */
  size?: '15/0'
}

/** A piece's faces and the beads of its joins, by the beads a side of its parts. */
interface PieceRule extends Omit<PieceFace, 'total'> {
  joins: (side: number) => JoinBeads[]
}

/** A Kaleidocycle's six Tetras, each a Strip of four triangles. Its joins as the Kali Primer's pictures show them at 9 a
 * side (ticket 0877): 8 Edge Beads on each Tetra side, two half-Hinge rows of 7 a Strip, a 15/0 at each triangle tip,
 * and 8 Hinge Pins on each of the 6 Hinges (one between every other pair of Hinge Beads, one at each end). */
const TETRAS = 6
const TETRA_SIDES = 6
const HALF_HINGE_ROWS = 2
const TRIANGLES = TETRAS * 4
const TRIANGLE_TIPS = 3
/** Three Mirror pairs and three ring joins. */
const HINGES = 6
const KALEIDOCYCLE: PieceRule = {
  faces: 4,
  parts: 6,
  joins: (side) => [
    { id: 'edgeBeads', count: TETRAS * TETRA_SIDES * (side - 1) },
    { id: 'hingeBeads', count: TETRAS * HALF_HINGE_ROWS * (side - 2) },
    { id: 'tips', count: TRIANGLES * TRIANGLE_TIPS, size: '15/0' },
    { id: 'hingePins', count: HINGES * (side - 1), size: '15/0' },
  ],
}

const PIECE_FACES: Partial<Record<FrameShapeId, PieceRule>> = { kaleidocycle: KALEIDOCYCLE }

/** The piece a Frame shape's Frame is one face of, or none where the Frame is the whole piece. */
export function pieceFaceOf(shape: FrameShapeId | undefined): PieceFace | undefined {
  const rule = shape && PIECE_FACES[shape]
  return rule ? { faces: rule.faces, parts: rule.parts, total: rule.faces * rule.parts } : undefined
}

/** The beads of a whole piece, every face beaded like this one (ticket 0876), and its joins (ticket 0877). */
export interface WholePiece {
  /** The faces' beads. */
  triangles: number
  /** The beads of the joins, each its own line. */
  joins: readonly JoinBeads[]
  /** Every bead of the face's own: the faces' and the joins' that are not 15/0s. */
  beads: number
  /** The 15/0s. */
  small: number
}

/** The whole piece a Frame of `faceBeads` beads is one face of, its parts as many beads a side as its Part size; none
 * where the Frame is the whole piece. */
export function wholePieceOf(frame: Pick<FrameSheet, 'shape' | 'settings'>, faceBeads: number): WholePiece | undefined {
  const rule = frame.shape && PIECE_FACES[frame.shape]
  const side = settingsOf(frame)?.partSize
  if (!rule || side === undefined) return undefined
  const joins = rule.joins(side)
  const triangles = rule.faces * faceBeads
  const sum = (small: boolean) => joins.filter(({ size }) => (size !== undefined) === small).reduce((total, { count }) => total + count, 0)
  return { triangles, joins, beads: triangles + sum(false), small: sum(true) }
}

/** How many of the piece's beads each of a Frame's beads stands for, where its layout's back is beaded as the face's
 * mirror (ticket 0875, a Star): two, but one for a bead on both, a tip; none where the Frame is all its piece shows. */
export function backBeadsAt(frame: Parameters<typeof frameLayoutOf>[0]): ((position: GridPosition) => number) | undefined {
  const layout = frame.shape ? frameLayoutOf(frame) : undefined
  if (!layout?.back) return undefined
  const shared = new Set(layout.back.shared.map((index) => keyOf(layout.positions[index]!)))
  return (position) => (shared.has(keyOf(position)) ? 1 : 2)
}
