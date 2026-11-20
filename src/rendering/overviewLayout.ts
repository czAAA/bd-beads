import { frameWeave } from '../domain/layerWeave'
import { projectDimensions } from '../domain/projectExtent'
import { A4_PORTRAIT, mm, PRINT_BOARD_PAD, PRINT_MARGIN, PRINT_RULER, type PageSize } from './printPlan'
import type { PrintText } from './printText'
import { displayedExtentPx } from './surfaceView'
import { type Layered, quarterTurnOf } from '../domain/layerRecord'

// Where everything sits on page 1 when it is the overview of a piece cut into parts (tickets 0583, 0914; it began as the old
// Cover of ticket 0583, which the PNG was until ticket 0915), and how Beads needed is cut into list pages, worked out without a canvas
// so the drawing and the page count agree. Page px at 150 dpi, like the rest of the print layout.

/** Between the framed Schema and Beads needed. */
const OVERVIEW_GAP = mm(8)
/** The band above the board's top ruler that the "101 →" cut labels of the PDF sit in. */
export const OVERVIEW_CUT_LABEL = mm(3.5)
/** The footer row (wordmark, date and time, page number) at the bottom of page 1 and the list pages. */
export const PAGE_FOOTER = mm(6)
/** Beads needed takes at most this share of the room under the title block; the rest of the colors go on list pages. */
export const TABLE_SHARE = 0.4
/** Beads needed with no colors: the line saying so. */
const TABLE_EMPTY = mm(6)
export const TABLE_COLUMN_GAP = mm(8)

type OverviewWords = Pick<PrintText, 'name' | 'maker' | 'colors'>

/** The heights of a Beads needed table: its head (over the first row), a row of colors, and the Total and grams note that
 * end it. */
export interface TableRows {
  head: number
  row: number
  end: number
}

/** One page's share of Beads needed: which colors it lists, and whether the Total line ends it. */
export interface ColorsSlice {
  from: number
  count: number
  rowHeight: number
  /** One color to a row as wide as the page, or two columns that read down (ticket 1096). */
  columns: 1 | 2
  /** Rows in each column. */
  rows: number
  /** Whether the Total line and the grams note end this page. */
  total: boolean
}

export interface OverviewLayout {
  /** The title block's height: the name, "by {maker}" and the tech line, each only when there is something to say. */
  titleHeight: number
  zoom: number
  extent: { width: number; height: number }
  /** Where the beads' own top-left corner lands, the framed Schema at the top of the room it has (page 1 centres it once
   * Beads needed is at the foot of the page, atTheFoot). */
  board: { x: number; y: number }
  /** Beads needed under the overview, and the top of it. */
  needed: ColorsSlice & { y: number }
  /** Beads needed on each list page that follows (none when it all fits). */
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

/** The height of a Beads needed block listing `count` colors in two columns, or one to a row. */
export function colorsHeight(count: number, table: TableRows, total: boolean, columns: 1 | 2 = 2): number {
  return table.head + (count === 0 ? TABLE_EMPTY : Math.ceil(count / columns) * table.row) + (total ? table.end : 0)
}

/** `slice` one color to a row when it holds every color, with the Total, and that still fits above `bottom` (ticket 1096;
 * PrintPage1 card): the room was worked out from the table in two columns, so the chart is never smaller for it. */
export function oneToARow<Slice extends ColorsSlice & { y: number }>(slice: Slice, table: TableRows, bottom: number, slop: number): Slice {
  const fits = slice.from === 0 && slice.total && slice.y + colorsHeight(slice.count, table, true, 1) <= bottom + slop
  return fits ? { ...slice, columns: 1, rows: slice.count } : slice
}

/** Beads needed set at the foot of the page, right over the footer (ticket 1138): `slice.y` is its top straight under the
 * chart, and `drop` how far the chart over it moves down to sit centred in the room between the title block and the table. */
export function atTheFoot<Slice extends ColorsSlice & { y: number }>(slice: Slice, table: TableRows, bottom: number): { needed: Slice; drop: number } {
  const y = Math.max(slice.y, bottom - colorsHeight(slice.count, table, slice.total, slice.columns))
  return { needed: { ...slice, y }, drop: (y - slice.y) / 2 }
}

/** The list pages that carry on Beads needed from color `from` on: as many colors as a page has room for, the Total
 * ending the last. */
export function listSlices(words: OverviewWords, table: TableRows, from: number, page: PageSize = A4_PORTRAIT): ColorsSlice[] {
  const colors = words.colors.length
  const rowsOnPage = Math.max(1, Math.floor((page.height - PRINT_MARGIN * 2 - PAGE_FOOTER - listHeader(words) - table.head - table.end) / table.row))
  const lists: ColorsSlice[] = []
  for (let next = from; next < colors || lists.length === 0;) {
    const count = Math.min(colors - next, rowsOnPage * 2)
    lists.push({ from: next, count, rowHeight: table.row, columns: 2, rows: Math.ceil(count / 2), total: next + count >= colors })
    next += count
  }
  return lists
}

/** Page 1 as the overview (and its list pages) for a Project's words, with Beads needed as `table`: the whole piece as large
 * as the room the title block and Beads needed (at most its share) leave, at its top and centred across, Beads needed
 * straight under it. */
export function overviewLayout(project: Layered, words: OverviewWords, table: TableRows, page: PageSize = A4_PORTRAIT): OverviewLayout {
  const rowHeight = table.row
  const titleHeight = titleHeightOf(words)
  const top = PRINT_MARGIN + titleHeight
  const bottom = page.height - PRINT_MARGIN - PAGE_FOOTER
  const available = bottom - top
  const colors = words.colors.length

  // Beads needed: all of it when it takes no more than its share, else the rows that fit and the rest on list pages.
  const budget = available * TABLE_SHARE
  const whole = colorsHeight(colors, table, true) <= budget
  const fitting = Math.max(1, Math.floor((budget - table.head) / rowHeight)) * 2
  const onPageOne = whole ? colors : Math.min(colors, fitting)
  const needed: ColorsSlice = { from: 0, count: onPageOne, rowHeight, columns: 2, rows: Math.ceil(onPageOne / 2), total: whole }
  const tableHeight = colorsHeight(onPageOne, table, whole)

  const wide = displayedExtentPx(frameWeave(project).technique, projectDimensions(project).columns, projectDimensions(project).rows, 1, quarterTurnOf(project), frameWeave(project).cell)
  const inset = PRINT_RULER + PRINT_BOARD_PAD
  const room = available - tableHeight - OVERVIEW_GAP
  const widthRoom = page.width - PRINT_MARGIN * 2 - inset * 2
  const zoom = Math.max(0.01, Math.min(widthRoom / wide.width, (room - OVERVIEW_CUT_LABEL - inset * 2) / wide.height))
  const extent = { width: wide.width * zoom, height: wide.height * zoom }
  const board = { x: PRINT_MARGIN + inset + (widthRoom - extent.width) / 2, y: top + OVERVIEW_CUT_LABEL + inset }

  const lists = whole ? [] : listSlices(words, table, onPageOne, page)

  return { titleHeight, zoom, extent, board, needed: { ...needed, y: board.y + extent.height + inset + OVERVIEW_GAP }, lists }
}
