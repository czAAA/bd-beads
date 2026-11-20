import { forEachBead, type BeadMap, type Rect } from '../domain/canvas'
import type { Project } from '../domain/project'
import { CELL_SIZE_PX } from './cellSize'
import { coverPageLayout } from './coverPageLayout'
import { pageOneLayout, underLargeBeads } from './pageOneLayout'
import { chartOnPageOne, mm, PRINT_DPI } from './printPlan'
import type { PrintText } from './printText'
import { pdfPageCount } from './wordChartPages'
import { beadsOfLayer, frameOf } from '../domain/layerRecord'

// The File size estimate (tickets 0588, 0914, 0915, 1096, ADR 0076): each page by its kind and content, every figure lifted to sit at or
// above 65 real Projects measured on 2026-10-27 (8 to 237 beads a side, 1 to 300 colors, three Techniques), so never below
// the file. Content it cannot see (noise, one bead on a big empty board) can leave a file well under it.

/** What an export is made of, read once from the Project and its words: the estimates of each format and dpi come from it. */
export interface ExportFacts {
  /** Colors in Beads needed. */
  colors: number
  /** The Frame's cells and the beads on it, and where a bead's color differs from the next below or to the right. */
  cells: number
  filled: number
  edges: number
  /** Page 1 (ticket 0914): the colors its Beads needed lists, and the overview's zoom when the chart is cut into parts; the
   * list pages after it, with the colors on each. */
  pageOneColors: number
  overviewZoom?: number
  lists: number[]
  /** The Cover page's zoom, the picture's whatever the switch says, and whether the PDF opens on it (ticket 1096). */
  coverZoom: number
  pdfCover: boolean
  /** The chart pages after page 1, and the area of every part of the chart, on page 1 or on them, in grid units. */
  sheets: number
  partArea: number
  /** The Word chart: its pages, rows and characters in the rows (0 without Row by row, ticket 0916). */
  wordPages: number
  wordRows: number
  wordChars: number
  /** The PDF's pages, all of the above (pdfPageCount): the Printable chart row's count. */
  pdfPages: number
  /** Whether Large beads changes this export (ticket 1125), so the Export rows offer it: on, the words carry it only
   * where it acts; off, the plan prints a bead under 3 mm. */
  largeBeadsActs: boolean
}

/** One export's size: its bytes and how many files (PNG, always one) or pages (PDF) it comes to. */
export interface SizeEstimate {
  bytes: number
  count: number
}

/** How many beads there are, and where a bead's color differs from its right-hand or lower neighbor (an empty position
 * counts as a color). The cost of a page of beads follows these, not the Frame's size. */
function beadsOf(frame: Rect, beads: BeadMap): { filled: number; edges: number } {
  const at = new Map<number, string>()
  forEachBead(beads, (row, column, hex) => at.set(row * frame.columns + column, hex))
  let edges = 0
  for (const [key, hex] of at) {
    const row = Math.floor(key / frame.columns)
    if (key - row * frame.columns + 1 < frame.columns && at.get(key + 1) !== hex) edges += 1
    if (row + 1 < frame.rows && at.get(key + frame.columns) !== hex) edges += 1
  }
  return { filled: at.size, edges }
}

/** The facts of an export of this Project in these words, or nothing without a Frame. */
export function exportFacts(project: Project, words: PrintText): ExportFacts | undefined {
  const frame = frameOf(project)
  if (!frame) return undefined
  const pageOne = pageOneLayout(project, words)
  const { plan } = pageOne
  const { filled, edges } = beadsOf(frame, beadsOfLayer(project, 'frame')!)
  const pdfPages = pdfPageCount(plan, words)
  return {
    colors: words.colors.length,
    cells: frame.columns * frame.rows,
    filled,
    edges,
    pageOneColors: pageOne.needed.count,
    ...(pageOne.overview ? { overviewZoom: pageOne.overview.zoom } : {}),
    lists: pageOne.lists.map((list) => list.count),
    coverZoom: coverPageLayout(project).zoom,
    pdfCover: !!words.cover,
    sheets: chartOnPageOne(plan) ? 0 : new Set(plan.parts.map((part) => part.page)).size,
    partArea: plan.parts.reduce((sum, part) => sum + (part.lastAcross - part.firstAcross + 1) * (part.lastDown - part.firstDown + 1), 0),
    wordPages: pdfPages - plan.pageCount,
    wordRows: words.wordChart?.rows.length ?? 0,
    wordChars: words.wordChart?.rows.reduce((sum, row) => sum + row.runs.length, 0) ?? 0,
    pdfPages,
    largeBeadsActs: !!words.largeBeads || underLargeBeads(plan),
  }
}

/** The figures at the dpi, read between the three the exports are drawn at. */
function atDpi(figures: Readonly<Record<150 | 300 | 450, readonly number[]>>, dpi: number): number[] {
  const [low, high] = dpi <= 300 ? ([150, 300] as const) : ([300, 450] as const)
  const t = Math.min(1, Math.max(0, (dpi - low) / (high - low)))
  return figures[low].map((value, index) => value + (figures[high][index]! - value) * t)
}

/** The overview's bytes at a dpi (page 1 of a piece cut into parts; measured on the Cover page it began as, 2026-10-30): a
 * constant, the colors it lists, the board's cells, the beads and their edges, and the crosses on empty positions (ticket
 * 0719), the last four each by the bead's size on the page. */
const OVERVIEW_BYTES = {
  150: [22_755, 5_637, 31.54, 59.12, 66.82, 130],
  300: [83_519, 9_703, 38.82, 116.38, 132.67, 340],
  450: [155_841, 23_447, 45.09, 140.36, 143.94, 540],
} as const

/** The Cover page's bytes, PDF and picture (ticket 1096; 15 pieces measured 2026-11-20 at each dpi, 5 × 5 to 250 × 250, 1 to
 * 90 colors): a constant, then by the bead's size in device px: the beads, their area, the color edges, the edges again by
 * the bead's size up to `COVER_SHORT_EDGE_MM`, and the area by the colors (up to 100). */
const COVER_PAGE_BYTES = {
  150: [86_800, 0.063, 0.0444, 1.8, 0.233, 1.82],
  300: [196_000, 0, 0.0546, 5.22, 0, 0.892],
  450: [352_000, 0.0663, 0.00992, 5.87, 0, 0.662],
} as const
const COVER_COLORS = 100
const COVER_SHORT_EDGE_MM = 2.5

function coverBytes(facts: ExportFacts, dpi: number, zoom: number): number {
  const [base, perBead, perArea, perEdge, perShortEdge, perColorArea] = atDpi(COVER_PAGE_BYTES, dpi) as [number, number, number, number, number, number]
  const bead = (CELL_SIZE_PX * zoom * dpi) / PRINT_DPI
  const short = Math.min(bead, (mm(COVER_SHORT_EDGE_MM) * dpi) / PRINT_DPI)
  const area = facts.filled * bead * bead
  const edges = facts.edges * bead
  return base + perBead * facts.filled * bead + perArea * area + perEdge * edges + perShortEdge * edges * short + (perColorArea * area * Math.min(facts.colors, COVER_COLORS)) / COVER_COLORS
}

/** What a page of text costs at a dpi, against 300 (the figures below). */
const TEXT_AT_DPI = { 150: [0.46], 300: [1], 450: [1.74] } as const

function textAtDpi(dpi: number): number {
  return atDpi(TEXT_AT_DPI, dpi)[0]!
}

/** At 300 dpi: a list page of Beads needed. */
const LIST_BASE = 60_000
const LIST_PER_COLOR = 4_400
/** The PDF's page 1 as a chart (at 300 dpi): the picture of its text, and each color of its Beads needed table. */
const PAGE_ONE_BASE = 110_000
const PAGE_ONE_PER_COLOR = 4_400
/** A chart page's picture of its text (at 300 dpi), and its drawing: a constant, the beads and the grid's area. */
const CHART_PICTURE = 92_400
const CHART_DRAWING = 4_400
const CHART_PER_BEAD = 11.2
const CHART_PER_AREA = 6.6
/** A Word chart page at 300 dpi: a constant, its key by the colors, then the rows and the characters in them. */
const WORD_PAGE = 73_700
const WORD_PAGE_PER_COLOR = 2_600
const WORD_COLORS = 300
const WORD_PER_ROW = 4_460
const WORD_PER_CHARACTER = 113
/** What a PNG's header and end, and a PDF's page object and stream headers, add to a page. */
const PNG_OVERHEAD = 200
const PDF_PAGE_OVERHEAD = 2_000

/** The overview's bytes at a dpi, with its board at `zoom`; every empty position carries its cross (tickets 0719, 0818). */
function overviewBytes(facts: ExportFacts, dpi: number, zoom: number): number {
  const [base, perColor, perCell, perBead, perEdge, perCross] = atDpi(OVERVIEW_BYTES, dpi) as [number, number, number, number, number, number]
  const board = (perCell * facts.cells + perBead * facts.filled + perEdge * facts.edges + perCross * (facts.cells - facts.filled)) * zoom
  return base + (perColor + PAGE_ONE_PER_COLOR * textAtDpi(dpi)) * facts.pageOneColors + board
}

/** Page 1's picture at a dpi: the overview, or the text round the chart (the chart itself is drawing). */
function pageOneBytes(facts: ExportFacts, dpi: number): number {
  if (facts.overviewZoom !== undefined) return overviewBytes(facts, dpi, facts.overviewZoom)
  return (PAGE_ONE_BASE + PAGE_ONE_PER_COLOR * facts.pageOneColors) * textAtDpi(dpi)
}

function listBytes(lists: number[], dpi: number): number {
  return lists.reduce((sum, colors) => sum + (LIST_BASE + LIST_PER_COLOR * colors) * textAtDpi(dpi), 0)
}

/** The PNG: the Cover page as one picture drawn at `dpi` (ticket 1096). */
export function estimatePng(facts: ExportFacts, dpi: number): SizeEstimate {
  return { bytes: Math.ceil(coverBytes(facts, dpi, facts.coverZoom) + PNG_OVERHEAD), count: 1 }
}

/** The PDF: the Cover page as a picture (ticket 1096), page 1 (the chart as drawing over a picture of its text, or the
 * overview as a picture), its list pages and the Word chart as pictures drawn at `dpi`, and its chart pages vector over a
 * picture of their text (ticket 0914). */
export function estimatePdf(facts: ExportFacts, dpi: number): SizeEstimate {
  const text = textAtDpi(dpi)
  const count = facts.pdfPages
  const pageOne = pageOneBytes(facts, dpi) + (facts.overviewZoom === undefined ? CHART_DRAWING : 0)
  const charts = facts.sheets * (CHART_PICTURE * text + CHART_DRAWING) + CHART_PER_BEAD * facts.filled + CHART_PER_AREA * facts.partArea
  const wordPages = facts.wordPages * (WORD_PAGE + WORD_PAGE_PER_COLOR * Math.min(facts.colors, WORD_COLORS))
  const word = (wordPages + WORD_PER_ROW * facts.wordRows + WORD_PER_CHARACTER * facts.wordChars) * text
  const cover = facts.pdfCover ? coverBytes(facts, dpi, facts.coverZoom) : 0
  return { bytes: Math.ceil(cover + pageOne + listBytes(facts.lists, dpi) + charts + word + count * PDF_PAGE_OVERHEAD), count }
}
