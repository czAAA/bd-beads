import { forEachBead } from '../domain/canvas'
import type { Project } from '../domain/project'
import { coverLayout } from './coverLayout'
import { planWithKey } from './chartPageKey'
import type { PrintText } from './printText'
import { wordChartPageCount } from './wordChartPages'

// The File size estimate (ticket 0588, ADR 0076): each page by its kind and content, every figure lifted to sit at or above
// 65 real Projects measured on 2026-10-27 (8 to 237 beads a side, 1 to 300 colors, three Techniques), so never below the
// file. Content it cannot see (noise, one bead on a big empty board) can leave a file well under it.

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
  /** The pages Beads needed runs over onto, with the colors on each. */
  lists: number[]
  /** The chart pages and the area of every part on them, in grid units. */
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
function beadsOf(frame: NonNullable<Project['frame']>): { filled: number; edges: number } {
  const at = new Map<number, string>()
  forEachBead(frame.beads, (row, column, hex) => at.set(row * frame.columns + column, hex))
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
  const { frame } = project
  if (!frame) return undefined
  const layout = coverLayout(project, words)
  const plan = planWithKey(project, layout.lists.length)
  const { filled, edges } = beadsOf(frame)
  return {
    colors: words.colors.length,
    coverColors: layout.cover.count,
    zoom: layout.zoom,
    cells: frame.columns * frame.rows,
    filled,
    edges,
    lists: layout.lists.map((list) => list.count),
    sheets: new Set(plan.parts.map((part) => part.page)).size,
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

/** The Cover's bytes at a dpi: a constant, the colors it lists, the board's cells, and the beads and their edges, the last
 * three each by the bead's size on the page. */
const COVER_BYTES = {
  150: [22_755, 5_637, 31.54, 59.12, 66.82],
  300: [83_519, 9_703, 38.82, 116.38, 132.67],
  450: [155_841, 23_447, 45.09, 140.36, 143.94],
} as const

/** What a page of text costs at a dpi, against 300 (the figures below). */
const TEXT_AT_DPI = { 150: [0.46], 300: [1], 450: [1.74] } as const

function textAtDpi(dpi: number): number {
  return atDpi(TEXT_AT_DPI, dpi)[0]!
}

/** At 300 dpi: a list page of Beads needed. */
const LIST_BASE = 60_000
const LIST_PER_COLOR = 4_400
/** The Specification: a constant and the colors it lists, up to the colors a page has room for. */
const SPEC_BASE = 143_000
const SPEC_PER_COLOR = 3_720
const SPEC_COLORS = 100
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

function coverBytes(facts: ExportFacts, dpi: number): number {
  const [base, perColor, perCell, perBead, perEdge] = atDpi(COVER_BYTES, dpi) as [number, number, number, number, number]
  return base + perColor * facts.coverColors + (perCell * facts.cells + perBead * facts.filled + perEdge * facts.edges) * facts.zoom
}

function listBytes(facts: ExportFacts, dpi: number): number {
  return facts.lists.reduce((sum, colors) => sum + (LIST_BASE + LIST_PER_COLOR * colors) * textAtDpi(dpi), 0)
}

/** The PNG: the Cover, then a file for every list page Beads needed runs over onto, drawn at `dpi`. */
export function estimatePng(facts: ExportFacts, dpi: number): SizeEstimate {
  const count = 1 + facts.lists.length
  return { bytes: Math.ceil(coverBytes(facts, dpi) + listBytes(facts, dpi) + count * PNG_OVERHEAD), count }
}

/** The PDF, its picture pages (the Cover, the list pages, the Specification, the Word chart) drawn at `dpi`, and its chart pages vector over a picture of their text. */
export function estimatePdf(facts: ExportFacts, dpi: number): SizeEstimate {
  const text = textAtDpi(dpi)
  const count = 1 + facts.lists.length + facts.sheets + 1 + facts.wordPages
  const specification = (SPEC_BASE + SPEC_PER_COLOR * Math.min(facts.colors, SPEC_COLORS)) * text
  const charts = facts.sheets * (CHART_PICTURE * text + CHART_DRAWING) + CHART_PER_BEAD * facts.filled + CHART_PER_AREA * facts.partArea
  const wordPages = facts.wordPages * (WORD_PAGE + WORD_PAGE_PER_COLOR * Math.min(facts.colors, WORD_COLORS))
  const word = (wordPages + WORD_PER_ROW * facts.wordRows + WORD_PER_CHARACTER * facts.wordChars) * text
  return { bytes: Math.ceil(coverBytes(facts, dpi) + listBytes(facts, dpi) + specification + charts + word + count * PDF_PAGE_OVERHEAD), count }
}
