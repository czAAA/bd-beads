import { planWithKey } from './chartPageKey'
import { atTheFoot, colorsHeight, PAGE_FOOTER, overviewLayout, listSlices, oneToARow, TABLE_SHARE, titleHeightOf, type ColorsSlice, type TableRows } from './overviewLayout'
import { A4_PORTRAIT, afterCoverPage, chartOnPageOne, mm, PRINT_BEAD_LARGE_MM, PRINT_MARGIN, PRINT_PART_LABEL, PRINT_RULER, type PageSize, type PrintPlan } from './printPlan'
import type { PrintText } from './printText'
import type { Project } from '../domain/project'
import type { Layered } from '../domain/layerRecord'

// Where everything sits on the PDF's page 1 (ticket 0914; PrintPage1 card), worked out without a canvas so the drawing,
// the page count and the File size estimate agree: the title block, the whole piece, one Beads needed table at the foot of
// the page with the piece centred over it (ticket 1138), the footer.

/** Beads needed on page 1 and its list pages: the heading and its rule, the column heads, a row of colors (its letter
 * swatch), and the Total and the grams note. */
export const NEEDED_HEADING = mm(6)
export const NEEDED_COLUMNS = mm(4.5)
const NEEDED_TABLE: TableRows = { head: NEEDED_HEADING + NEEDED_COLUMNS, row: mm(5), end: mm(14) }
/** Between the chart's pad (its rulers) and Beads needed. */
const NEEDED_GAP = mm(4)
/** Slack for the rounding of a table that exactly fills its room. */
const FIT_SLOP = 1

type Counted = Layered & Pick<Project, 'paletteLetters'>
type PageOneWords = Pick<PrintText, 'name' | 'maker' | 'colors' | 'largeBeads' | 'cover'>

export interface PageOneLayout {
  /** The PDF's plan: the chart whole on page 1 (`chartOnPageOne`), or its parts on the chart pages after it. */
  plan: PrintPlan
  titleHeight: number
  /** The top left corner of page 1's chart area: under the title block, moved down so the chart sits centred between it
   * and Beads needed. */
  area: { x: number; y: number }
  /** Page 1 as the overview of a chart cut into parts (no letters, the parts marked): its zoom, size and where its beads
   * begin (overviewLayout). */
  overview?: { zoom: number; extent: { width: number; height: number }; board: { x: number; y: number } }
  /** Beads needed on page 1, and its top. */
  needed: ColorsSlice & { y: number }
  /** Beads needed on each list page after page 1 (none when it all fits). */
  lists: ColorsSlice[]
}

/** Slack for a plan held at exactly `print-bead-large`. */
const BEAD_SLOP_MM = 1e-6

/** Whether a plan prints a bead under `print-bead-large`, the only plans Large beads changes (ticket 1125). */
export function underLargeBeads(plan: PrintPlan): boolean {
  return plan.beadMm < PRINT_BEAD_LARGE_MM - BEAD_SLOP_MM
}

/** Whether Large beads changes this Project's PDF and picture (ticket 1125): only when its plan without it prints a bead
 * under 3 mm. A piece that prints at 3 mm or more already is left as it is, so the switch is not offered there. */
export function largeBeadsActs(project: Counted, words: PageOneWords, page: PageSize = A4_PORTRAIT): boolean {
  return underLargeBeads(pageOneLayout(project, { ...words, largeBeads: false }, page).plan)
}

/** Page 1 of the PDF for a Project's words, after the Cover page when the words ask for one (ticket 1096). */
export function pageOneLayout(project: Counted, words: PageOneWords, page: PageSize = A4_PORTRAIT): PageOneLayout {
  const layout = chartFirstLayout(project, words, page)
  return words.cover ? { ...layout, plan: afterCoverPage(layout.plan) } : layout
}

/** Page 1 of the PDF for a Project's words (ticket 0914): the chart whole when it fits at a working bead (planPrint; 3 mm
 * or more with Large beads, ticket 0916), Beads needed under it, at the foot of the page, as far as its share allows and the
 * rest on list pages; one color to a row when all of it fits that way (ticket 1096). Otherwise page 1 is the overview, and the chart parts follow. */
function chartFirstLayout(project: Counted, words: PageOneWords, page: PageSize): PageOneLayout {
  const floorMm = words.largeBeads ? PRINT_BEAD_LARGE_MM : undefined
  const titleHeight = titleHeightOf(words)
  const area = { x: PRINT_MARGIN, y: PRINT_MARGIN + titleHeight }
  const bottom = page.height - PRINT_MARGIN - PAGE_FOOTER
  const room = bottom - area.y
  const colors = words.colors.length
  // Beads needed straight under the chart, set one color to a row when that fits, then moved down to the foot of the page.
  const settled = (slice: ColorsSlice & { y: number }) => atTheFoot(oneToARow(slice, NEEDED_TABLE, bottom, FIT_SLOP), NEEDED_TABLE, bottom)
  const under = (table: number): PageSize => ({ width: page.width - PRINT_MARGIN * 2, height: room - NEEDED_GAP - table })
  const chartOver = (table: number) => {
    const plan = planWithKey(project, { page, floorMm, pageOne: under(table) })
    return chartOnPageOne(plan) ? { plan, pageOne: under(table) } : undefined
  }

  const full = colorsHeight(colors, NEEDED_TABLE, true)
  const least = colorsHeight(Math.min(colors, 2), NEEDED_TABLE, false)
  const chart = (full <= room * TABLE_SHARE ? chartOver(full) : undefined) ?? chartOver(least)
  if (chart) {
    // A pad's own bottom: a whole chart has no label above it to leave room for.
    const label = chart.plan.parts.length > 1 ? PRINT_PART_LABEL : 0
    const top = area.y + Math.max(...chart.plan.parts.map((part) => part.place.y + label + part.region.height + PRINT_RULER * 2)) + NEEDED_GAP
    const whole = full <= bottom - top + FIT_SLOP
    const fitting = Math.max(1, Math.floor((bottom - top - NEEDED_TABLE.head) / NEEDED_TABLE.row)) * 2
    const count = whole ? colors : Math.min(colors, fitting)
    const lists = whole ? [] : listSlices(words, NEEDED_TABLE, count, page)
    const plan = lists.length > 0 ? planWithKey(project, { page, floorMm, pageOne: chart.pageOne, listPages: lists.length }) : chart.plan
    const { needed, drop } = settled({ from: 0, count, rowHeight: NEEDED_TABLE.row, columns: 2, rows: Math.ceil(count / 2), total: whole, y: top })
    return { plan, titleHeight, area: { x: area.x, y: area.y + drop }, needed, lists }
  }

  const overview = overviewLayout(project, words, NEEDED_TABLE, page)
  const plan = planWithKey(project, { page, floorMm, pageOne: under(least), listPages: overview.lists.length })
  const { needed, drop } = settled(overview.needed)
  const board = { x: overview.board.x, y: overview.board.y + drop }
  return { plan, titleHeight, area, overview: { zoom: overview.zoom, extent: overview.extent, board }, needed, lists: overview.lists }
}
