import { forEachBead, type BeadMap, type Rect } from '../domain/canvas'
import type { Project } from '../domain/project'
import { coverLayout } from './coverLayout'
import { pageOneLayout } from './pageOneLayout'
import { chartOnPageOne } from './printPlan'
import type { PrintText } from './printText'
import { wordChartPageCount } from './wordChartPages'
import { beadsOfLayer, frameOf } from '../domain/layerRecord'

// The File size estimate (tickets 0588, 0914, ADR 0076): each page by its kind and content, every figure lifted to sit at or
// above 65 real Projects measured on 2026-10-27 (8 to 237 beads a side, 1 to 300 colors, three Techniques), so never below
// the file. Content it cannot see (noise, one bead on a big empty board) can leave a file well under it.

/** What an export is made of, read once from the Project and its words: the estimates of each format and dpi come from it. */
export interface ExportFacts {
  /** Colors in Beads needed, and how many of them the Cover has room for. */
  colors: number
  coverColors: number
  /** The Cover's zoom, the board's cells and the beads on it, and where a bead's color differs from the next below or to the right. */
  zoom: number
  cells: number
  filled: number
  edges: number
  /** The PNG files Beads needed runs over onto, with the colors on each. */
  lists: number[]
  /** The PDF's page 1 (ticket 0914): the colors its Beads needed lists, and the overview's zoom when the chart is cut into
   * parts (none: page 1 is the chart itself); the list pages after it, with the colors on each. */
  pageOneColors: number
  overviewZoom?: number
  pdfLists: number[]
  /** The chart pages after page 1, and the area of every part of the chart, on page 1 or on them, in grid units. */
  sheets: number
  partArea: number
  /** The Word chart: its pages, rows and characters in the rows (0 without Letters). */
  wordPages: number
  wordRows: number
  wordChars: number
}

/** One export's size: its bytes and how many files (PNG) or pages (PDF) it comes to. */
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
  const layout = coverLayout(project, words)
  const pageOne = pageOneLayout(project, words)
  const { plan } = pageOne
  const { filled, edges } = beadsOf(frame, beadsOfLayer(project, 'frame')!)
  return {
    colors: words.colors.length,
    coverColors: layout.cover.count,
    zoom: layout.zoom,
    cells: frame.columns * frame.rows,
    filled,
    edges,
    lists: layout.lists.map((list) => list.count),
    pageOneColors: pageOne.needed.count,
    ...(pageOne.overview ? { overviewZoom: pageOne.overview.zoom } : {}),
    pdfLists: pageOne.lists.map((list) => list.count),
    sheets: chartOnPageOne(plan) ? 0 : new Set(plan.parts.map((part) => part.page)).size,
    partArea: plan.parts.reduce((sum, part) => sum + (part.lastAcross - part.firstAcross + 1) * (part.lastDown - part.firstDown + 1), 0),
    wordPages: wordChartPageCount(words, plan.page),
    wordRows: words.wordChart?.rows.length ?? 0,
    wordChars: words.wordChart?.rows.reduce((sum, row) => sum + row.runs.length, 0) ?? 0,
  }
}

/** The figures at the dpi, read between the three the exports are drawn at. */
function atDpi(figures: Readonly<Record<150 | 300 | 450, readonly number[]>>, dpi: number): number[] {
  const [low, high] = dpi <= 300 ? ([150, 300] as const) : ([300, 450] as const)
  const t = Math.min(1, Math.max(0, (dpi - low) / (high - low)))
  return figures[low].map((value, index) => value + (figures[high][index]! - value) * t)
}

/** The Cover's bytes at a dpi: a constant, the colors it lists, the board's cells, the beads and their edges, and the
 * crosses on empty positions (ticket 0719, measured 2026-10-30), the last four each by the bead's size on the page. */
const COVER_BYTES = {
  150: [22_755, 5_637, 31.54, 59.12, 66.82, 130],
  300: [83_519, 9_703, 38.82, 116.38, 132.67, 340],
  450: [155_841, 23_447, 45.09, 140.36, 143.94, 540],
} as const

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

/** A Cover's bytes at a dpi, listing `colors` with its board at `zoom`; every empty position carries its cross, in the PNG
 * and on the PDF's overview (tickets 0719, 0818). */
function coverBytes(facts: ExportFacts, dpi: number, colors: number, zoom: number): number {
  const [base, perColor, perCell, perBead, perEdge, perCross] = atDpi(COVER_BYTES, dpi) as [number, number, number, number, number, number]
  return base + perColor * colors + (perCell * facts.cells + perBead * facts.filled + perEdge * facts.edges + perCross * (facts.cells - facts.filled)) * zoom
}

function listBytes(lists: number[], dpi: number): number {
  return lists.reduce((sum, colors) => sum + (LIST_BASE + LIST_PER_COLOR * colors) * textAtDpi(dpi), 0)
}

/** The PNG: the Cover, then a file for every list page Beads needed runs over onto, drawn at `dpi`. */
export function estimatePng(facts: ExportFacts, dpi: number): SizeEstimate {
  const count = 1 + facts.lists.length
  return { bytes: Math.ceil(coverBytes(facts, dpi, facts.coverColors, facts.zoom) + listBytes(facts.lists, dpi) + count * PNG_OVERHEAD), count }
}

/** The PDF: page 1 (the chart as drawing over a picture of its text, or the overview as a picture), its list pages and the
 * Word chart as pictures drawn at `dpi`, and its chart pages vector over a picture of their text (ticket 0914). */
export function estimatePdf(facts: ExportFacts, dpi: number): SizeEstimate {
  const text = textAtDpi(dpi)
  const count = 1 + facts.pdfLists.length + facts.sheets + facts.wordPages
  const pageOne = facts.overviewZoom === undefined
    ? (PAGE_ONE_BASE + PAGE_ONE_PER_COLOR * facts.pageOneColors) * text + CHART_DRAWING
    : coverBytes(facts, dpi, facts.pageOneColors, facts.overviewZoom) + PAGE_ONE_PER_COLOR * facts.pageOneColors * text
  const charts = facts.sheets * (CHART_PICTURE * text + CHART_DRAWING) + CHART_PER_BEAD * facts.filled + CHART_PER_AREA * facts.partArea
  const wordPages = facts.wordPages * (WORD_PAGE + WORD_PAGE_PER_COLOR * Math.min(facts.colors, WORD_COLORS))
  const word = (wordPages + WORD_PER_ROW * facts.wordRows + WORD_PER_CHARACTER * facts.wordChars) * text
  return { bytes: Math.ceil(pageOne + listBytes(facts.pdfLists, dpi) + charts + word + count * PDF_PAGE_OVERHEAD), count }
}
