import { keyOf } from './frameLayout'
import { frameLayoutOf, type FrameShapeId } from './frameShape'
import type { GridPosition } from './grid'

/** A Frame that is one face of a larger piece (ticket 0876): the faces the piece has, the parts one face shows and the
 * parts of the whole piece. Its counts are the face's; the piece's are the face's times its faces. */
export interface PieceFace {
  faces: number
  parts: number
  total: number
}

/** A Kaleidocycle's ring shows four faces of six triangles each (Kali Primer); its Frame is one face. */
const PIECE_FACES: Partial<Record<FrameShapeId, Omit<PieceFace, 'total'>>> = { kaleidocycle: { faces: 4, parts: 6 } }

/** The piece a Frame shape's Frame is one face of, or none where the Frame is the whole piece. */
export function pieceFaceOf(shape: FrameShapeId | undefined): PieceFace | undefined {
  const face = shape && PIECE_FACES[shape]
  return face ? { ...face, total: face.faces * face.parts } : undefined
}

/** The beads of the whole piece when every face is beaded like this one: the triangles only, no edge, tip or hinge
 * beads (ticket 0876). */
export function wholePieceBeads(face: PieceFace, faceBeads: number): number {
  return face.faces * faceBeads
}

/** How many of the piece's beads each of a Frame's beads stands for, where its layout's back is beaded as the face's
 * mirror (ticket 0875, a Star): two, but one for a bead on both, a tip; none where the Frame is all its piece shows. */
export function backBeadsAt(frame: Parameters<typeof frameLayoutOf>[0]): ((position: GridPosition) => number) | undefined {
  const layout = frame.shape ? frameLayoutOf(frame) : undefined
  if (!layout?.back) return undefined
  const shared = new Set(layout.back.shared.map((index) => keyOf(layout.positions[index]!)))
  return (position) => (shared.has(keyOf(position)) ? 1 : 2)
}
