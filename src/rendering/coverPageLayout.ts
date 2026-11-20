import type { Layered } from '../domain/layerRecord'
import { trimmedArea } from './chartPageKey'
import { A4_PORTRAIT, areaRegion, mm, PRINT_MARGIN, type PageSize } from './printPlan'

// Where the Cover page's board and piece sit (ticket 1096; PrintCover card), worked out without a canvas: the board as wide
// as the page inside its margins, the framed Schema trimmed to its beads (ticket 1128) and scaled to fill it inside its pad,
// with no smallest and no largest bead. Page px at 150 dpi, like the rest of the print layout.

/** The board's height (`print-cover-board`).
 * @internal The token test holds it to the token. */
export const COVER_BOARD = mm(196)
/** The board's pad round the piece on every side (`print-cover-pad`).
 * @internal The token test holds it to the token. */
export const COVER_PAD = mm(8)

interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface CoverPageLayout {
  /** The pale board under the piece. */
  board: Box
  /** The piece's zoom, and where its beads' own top-left corner lands and how far they reach. */
  zoom: number
  piece: Box
  /** Where the trimmed piece starts in the whole displayed Schema, at zoom 1 (ticket 1128). */
  start: { x: number; y: number }
}

/** The Cover page's board and the piece on it: trimmed to its beads, turned as its Canvas is, as large as the board allows
 * inside its pad, centred. */
export function coverPageLayout(project: Layered, page: PageSize = A4_PORTRAIT): CoverPageLayout {
  const board = { x: PRINT_MARGIN, y: PRINT_MARGIN, width: page.width - PRINT_MARGIN * 2, height: COVER_BOARD }
  const trimmed = areaRegion(project, trimmedArea(project))
  const zoom = Math.min((board.width - COVER_PAD * 2) / trimmed.width, (board.height - COVER_PAD * 2) / trimmed.height)
  const width = trimmed.width * zoom
  const height = trimmed.height * zoom
  return { board, zoom, piece: { x: board.x + (board.width - width) / 2, y: board.y + (board.height - height) / 2, width, height }, start: { x: trimmed.x, y: trimmed.y } }
}
