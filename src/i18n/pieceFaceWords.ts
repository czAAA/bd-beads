import { fillBlanks } from '../domain/fillBlanks'
import type { PieceFace } from '../domain/pieceFaces'
import type { Translations } from './translations'

const blanksOf = ({ faces, parts, total }: PieceFace) => ({ faces, parts, total })

/** What a Frame is of its piece, where it is one face (ticket 0876): "one face of 4: 6 of 24 triangles". */
export function faceOfPieceWords(t: Translations, face: PieceFace): string {
  return fillBlanks(t.starters.faceOfPiece, blanksOf(face))
}

/** The Info button's words beside a face's counts (ticket 0876): the piece's faces, a Frame for each other face, and
 * that only the triangles are counted. */
export function faceInfoWords(t: Translations, face: PieceFace): string {
  return fillBlanks(t.starters.faceInfo, blanksOf(face))
}
