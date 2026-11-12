import { frameWeave } from '../domain/layerWeave'
import { projectDimensions } from '../domain/projectExtent'
import { A4_PORTRAIT, mm, PRINT_BOARD_PAD, PRINT_MARGIN, PRINT_RULER, type PageSize } from './printPlan'
import type { PrintText } from './printText'
import { CELL_SIZE_PX } from './cellSize'
import { displayedExtentPx } from './surfaceView'
import { type Layered, quarterTurnOf } from '../domain/layerRecord'

// Where everything sits on the Cover page (ticket 0583; glossary: Cover page), worked out without a canvas so the drawing and
// the page count agree: the PNG, and the PDF's page 1 when it is the overview (ticket 0914, its own Beads needed table).
// Page px at 150 dpi, like the rest of the print layout.

/** A bead on the cover is never larger than this across, so a ring is not blown up to the page.
 * @internal Tests check a small Schema's beads stop at it. */
export const COVER_BEAD_MAX = mm(6)
/** Between the framed Schema and Beads needed. */
const COVER_GAP = mm(8)
/** The band above the board's top ruler that the "101 →" cut labels of the PDF sit in. */
export const COVER_CUT_LABEL = mm(3.5)
/** The footer row (wordmark, date and time) at the bottom of every cover and list page. */
export const COVER_FOOTER = mm(6)
/** Beads needed takes at most this share of the room under the title block; the rest of the colors go on list pages. */
export const TABLE_SHARE = 0.4
/** The heading of Beads needed, and the Total line and grams note that end it. */
export const TABLE_HEAD = mm(6)
const TABLE_END = mm(15)
const TABLE_EMPTY = mm(6)
export const TABLE_COLUMN_GAP = mm(8)

type CoverWords = Pick<PrintText, 'name' | 'maker' | 'colors'>

/** The heights of a Beads needed table: its head (over the first row), a row of colors, and the Total and grams note that
 * end it. */
export interface TableRows {
  head: number
  row: number
  end: number
}

/** The Cover's own Beads needed: swatch, name, beads and grams, a row taller when the swatches carry letters. */
function coverTable(words: Pick<PrintText, 'colors'>): TableRows {
  return { head: TABLE_HEAD, row: words.colors.some((color) => color.letter) ? mm(5.2) : mm(4.4), end: TABLE_END }
}
type CoverShape = Layered

/** One page's share of Beads needed: which colors it lists, and whether the Total line ends it. */
export interface ColorsSlice {
  from: number
  count: number
  rowHeight: number
  /** Rows in each of the two columns, which read down. */
  rows: number
  /** Whether the Total line and the grams note end this page. */
  total: boolean
}

export interface CoverLayout {
  /** The title block's height: the name, "by {maker}" and the tech line, each only when there is something to say. */
  titleHeight: number
  zoom: number
  extent: { width: number; height: number }
  /** Where the beads' own top-left corner lands, the framed Schema centred in the room it has. */
  board: { x: number; y: number }
  /** Beads needed on the cover, and the top of it. */
  cover: ColorsSlice & { y: number }
  /** Beads needed on each list page that follows the cover (none when it all fits). */
  lists: ColorsSlice[]
}

/** The title block's rows for these words. */
export function titleRows(words: Pick<PrintText, 'name' | 'maker'>): { name: boolean; maker: boolean } {
  return { name: words.name.trim() !== '', maker: words.maker !== '' }
}

/** The title block's rows: the name, "by {maker}", then the tech line and its gap under. */
export const TITLE_NAME_ROW = mm(10)
export const TITLE_MAKER_ROW = mm(7)
const TITLE_TECH_ROW = mm(7)
const TITLE_GAP = mm(3)

export function titleHeightOf(words: Pick<PrintText, 'name' | 'maker'>): number {
  const rows = titleRows(words)
  return (rows.name ? TITLE_NAME_ROW : 0) + (rows.maker ? TITLE_MAKER_ROW : 0) + TITLE_TECH_ROW + TITLE_GAP
}

/** A list page opens with the Project's name (when it has one), small, over the continued Beads needed. */
export function listHeader(words: Pick<PrintText, 'name'>): number {
  return words.name.trim() === '' ? 0 : mm(9)
}

/** The height of a Beads needed block listing `count` colors in two columns. */
export function colorsHeight(count: number, table: TableRows, total: boolean): number {
  return table.head + (count === 0 ? TABLE_EMPTY : Math.ceil(count / 2) * table.row) + (total ? table.end : 0)
}

/** The list pages that carry on Beads needed from color `from` on: as many colors as a page has room for, the Total
 * ending the last. */
export function listSlices(words: CoverWords, table: TableRows, from: number, page: PageSize = A4_PORTRAIT): ColorsSlice[] {
  const colors = words.colors.length
  const rowsOnPage = Math.max(1, Math.floor((page.height - PRINT_MARGIN * 2 - COVER_FOOTER - listHeader(words) - table.head - table.end) / table.row))
  const lists: ColorsSlice[] = []
  for (let next = from; next < colors || lists.length === 0;) {
    const count = Math.min(colors - next, rowsOnPage * 2)
    lists.push({ from: next, count, rowHeight: table.row, rows: Math.ceil(count / 2), total: next + count >= colors })
    next += count
  }
  return lists
}

/** The page's Cover (and list pages) layout for a Project's words, with the Cover's Beads needed or the table given. */
export function coverLayout(project: CoverShape, words: CoverWords, page: PageSize = A4_PORTRAIT, table: TableRows = coverTable(words)): CoverLayout {
  const rowHeight = table.row
  const titleHeight = titleHeightOf(words)
  const top = PRINT_MARGIN + titleHeight
  const bottom = page.height - PRINT_MARGIN - COVER_FOOTER
  const available = bottom - top
  const colors = words.colors.length

  // Beads needed: all of it when it takes no more than its share, else the rows that fit and the rest on list pages.
  const budget = available * TABLE_SHARE
  const whole = colorsHeight(colors, table, true) <= budget
  const fitting = Math.max(1, Math.floor((budget - table.head) / rowHeight)) * 2
  const onCover = whole ? colors : Math.min(colors, fitting)
  const cover: ColorsSlice = { from: 0, count: onCover, rowHeight, rows: Math.ceil(onCover / 2), total: whole }
  const tableHeight = colorsHeight(onCover, table, whole)

  const wide = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, 1, quarterTurnOf(project), frameWeave(project).cell)
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const room = available - tableHeight - COVER_GAP
  const widthRoom = page.width - PRINT_MARGIN * 2 - inset * 2
  const zoom = Math.max(0.01, Math.min(COVER_BEAD_MAX / CELL_SIZE_PX, widthRoom / wide.width, (room - COVER_CUT_LABEL - inset * 2) / wide.height))
  const extent = { width: wide.width * zoom, height: wide.height * zoom }
  const framed = COVER_CUT_LABEL + inset * 2 + extent.height
  const board = { x: PRINT_MARGIN + inset + (widthRoom - extent.width) / 2, y: top + (room - framed) / 2 + COVER_CUT_LABEL + inset }

  const lists = whole ? [] : listSlices(words, table, onCover, page)

  return { titleHeight, zoom, extent, board, cover: { ...cover, y: board.y + extent.height + inset + COVER_GAP }, lists }
}
