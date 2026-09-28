import { CELL_SIZE_PX, rotationSwapsAxes, type Rotation, type Technique } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { displayedExtentPx, rowPitchPx, type Region } from './patternRenderer'

/**
 * How the PDF for printing is laid out (ticket 162; printed-output.md, the PrintPage1 and PrintChartPage cards, the
 * `print-*` tokens). Page 1 shows the whole Pattern; the chart pages then split it into fixed 100 × 100-bead blocks
 * (ticket 185), an edge block simply however many beads remain. Each block's bead then grows until it fills its
 * page, the same on every page and never above 7 mm. Everything here is in page px at 150 dpi; nothing draws.
 */

export const PRINT_DPI = 150
/** Millimetres as page px. */
export function mm(value: number): number {
  return (value * PRINT_DPI) / 25.4
}

export const PRINT_BEAD_BASE_MM = 4.6
export const PRINT_BEAD_MAX_MM = 7
export const PRINT_MARGIN = mm(10)
export const PRINT_HEADER = mm(16)
export const PRINT_FOOTER = mm(8)
export const PRINT_NAME_BAND = mm(12)
export const PRINT_LEGEND_WIDTH = mm(48)
/** The rulers' band on each side of a chart, and the board's own edge around the beads. */
export const PRINT_RULER = mm(5)
export const PRINT_BOARD_PAD = mm(2.5)
/** Room for a stacked part's own "Part N · columns A–B" label (PrintStrips), and the gap between stacked boards. */
export const PRINT_STRIP_LABEL = mm(6)
export const PRINT_STRIP_GAP = mm(6)

export interface PageSize {
  width: number
  height: number
}

/** A4 at 150 dpi. */
export const A4_PORTRAIT: PageSize = { width: 1240, height: 1754 }
export const A4_LANDSCAPE: PageSize = { width: 1754, height: 1240 }
/** @deprecated use `A4_PORTRAIT`, or `orientedPage` to pick the orientation the Pattern wants. */
export const A4 = A4_PORTRAIT

/** What a chart page leaves for the beads themselves: inside the margins, header, name band, footer, rulers and board. */
export function chartArea(page: PageSize): PageSize {
  const inset = (PRINT_RULER + PRINT_BOARD_PAD) * 2
  return {
    width: page.width - PRINT_MARGIN * 2 - inset,
    height: page.height - PRINT_MARGIN * 2 - PRINT_HEADER - PRINT_FOOTER - PRINT_NAME_BAND - inset,
  }
}

export interface PrintPart {
  /** The page it prints on (page 1 is the whole Pattern). Several parts share a page when they are stacked (see `PrintPlan.strip`). */
  page: number
  /** Which part across and down, from 0. */
  across: number
  down: number
  /** The displayed beads it holds, across and down, from 0 (a turned Pattern's rows run across). */
  firstAcross: number
  lastAcross: number
  firstDown: number
  lastDown: number
  /** Where it sits in the whole displayed chart at the plan's zoom, in px. */
  region: Region
}

export interface PrintPlan {
  /** Landscape when the Pattern is wider than tall, portrait otherwise (printed-output.md, Wide and long Patterns). */
  page: PageSize
  /** How far the renderer enlarges the Pattern on the chart pages: one bead is CELL_SIZE_PX × zoom px. */
  zoom: number
  partsAcross: number
  partsDown: number
  parts: PrintPart[]
  pageCount: number
  /**
   * True when a part would fill less than half its page (a bracelet, split only one way): several parts then share a
   * sheet at the base bead size instead of one nearly-empty page each (PrintStrips).
   */
  strip: boolean
}

/** Wider than tall, as displayed (a turned Pattern's rows run across). */
export function isPatternWide(pattern: Shape): boolean {
  const { width, height } = displayedExtentPx(pattern.technique, pattern.columns, pattern.rows, 1, pattern.rotation)
  return width > height
}

/** A4, landscape for a Pattern wider than tall and portrait otherwise; nothing else about the layout changes. */
export function orientedPage(pattern: Shape): PageSize {
  return isPatternWide(pattern) ? A4_LANDSCAPE : A4_PORTRAIT
}

type Shape = Pick<Pattern, 'technique' | 'columns' | 'rows' | 'rotation'>

/** Beads across and down as the Pattern shows (turned, its rows run across at a quarter turn), and one bead's step each way at zoom 1. */
export function displayedGrid({ technique, columns, rows, rotation }: Shape) {
  const pitch = rowPitchPx(technique)
  return rotationSwapsAxes(rotation)
    ? { across: rows, down: columns, stepAcross: pitch, stepDown: CELL_SIZE_PX }
    : { across: columns, down: rows, stepAcross: CELL_SIZE_PX, stepDown: pitch }
}

/** The displayed size of a block of beads `across` × `down`, at zoom 1. */
function blockExtent(technique: Technique, rotation: Rotation, across: number, down: number): PageSize {
  const [columns, rows] = rotationSwapsAxes(rotation) ? [down, across] : [across, down]
  return displayedExtentPx(technique, columns, rows, 1, rotation)
}

/** A chart page's block, fixed (ticket 185): 100 beads a side, an edge block simply however many remain. */
export const PRINT_BLOCK_BEADS = 100

export function planPrint(pattern: Shape, page: PageSize = orientedPage(pattern)): PrintPlan {
  const area = chartArea(page)
  const grid = displayedGrid(pattern)
  const baseZoom = mm(PRINT_BEAD_BASE_MM) / CELL_SIZE_PX
  const maxZoom = mm(PRINT_BEAD_MAX_MM) / CELL_SIZE_PX

  // Fixed 100 × 100-bead blocks, not sized to what fits the page: a Pattern within a block's reach needs no split at
  // all, and a huge one splits into a predictable grid instead of parts computed from the base bead's legibility.
  const partAcross = Math.min(PRINT_BLOCK_BEADS, grid.across)
  const partDown = Math.min(PRINT_BLOCK_BEADS, grid.down)
  const partsAcross = Math.ceil(grid.across / partAcross)
  const partsDown = Math.ceil(grid.down / partDown)

  // A bracelet splits only one way (here, across): the other axis (down) then stays the same, short, size on every
  // part. When that leaves a part filling less than half its page, several share a sheet instead (PrintStrips).
  const strip = partsDown === 1 && partsAcross > 1 ? planStrips(pattern, page, area, grid, baseZoom, partAcross) : undefined
  if (strip) return strip

  // The block, then the largest bead at which one fills the page; an edge block simply draws smaller, at the same zoom.
  const part = blockExtent(pattern.technique, pattern.rotation, partAcross, partDown)
  const zoom = Math.min(maxZoom, area.width / part.width, area.height / part.height)

  const parts: PrintPart[] = []
  for (let down = 0; down < partsDown; down += 1) {
    for (let across = 0; across < partsAcross; across += 1) {
      const firstAcross = across * partAcross
      const firstDown = down * partDown
      const lastAcross = Math.min(grid.across, firstAcross + partAcross) - 1
      const lastDown = Math.min(grid.down, firstDown + partDown) - 1
      const extent = blockExtent(pattern.technique, pattern.rotation, lastAcross - firstAcross + 1, lastDown - firstDown + 1)
      parts.push({
        page: parts.length + 2,
        across,
        down,
        firstAcross,
        lastAcross,
        firstDown,
        lastDown,
        region: {
          x: firstAcross * grid.stepAcross * zoom,
          y: firstDown * grid.stepDown * zoom,
          width: Math.ceil(extent.width * zoom),
          height: Math.ceil(extent.height * zoom),
        },
      })
    }
  }

  return { page, zoom, partsAcross, partsDown, parts, pageCount: parts.length + 1, strip: false }
}

type Grid = ReturnType<typeof displayedGrid>

/** Stacks equal across-only parts several to a sheet, at the base bead size, when doing one page each would waste paper. */
function planStrips(pattern: Shape, page: PageSize, area: PageSize, grid: Grid, baseZoom: number, partAcross: number): PrintPlan | undefined {
  const partsAcross = Math.ceil(grid.across / partAcross)
  const downExtent = blockExtent(pattern.technique, pattern.rotation, partAcross, grid.down).height * baseZoom
  if (downExtent >= area.height / 2) return undefined

  const stripHeight = PRINT_STRIP_LABEL + (PRINT_RULER + PRINT_BOARD_PAD) * 2 + downExtent
  const perSheet = Math.floor((area.height + PRINT_STRIP_GAP) / (stripHeight + PRINT_STRIP_GAP))
  if (perSheet < 2) return undefined

  const parts: PrintPart[] = []
  for (let across = 0; across < partsAcross; across += 1) {
    const firstAcross = across * partAcross
    const lastAcross = Math.min(grid.across, firstAcross + partAcross) - 1
    const extent = blockExtent(pattern.technique, pattern.rotation, lastAcross - firstAcross + 1, grid.down)
    parts.push({
      page: 2 + Math.floor(across / perSheet),
      across,
      down: 0,
      firstAcross,
      lastAcross,
      firstDown: 0,
      lastDown: grid.down - 1,
      region: {
        x: firstAcross * grid.stepAcross * baseZoom,
        y: 0,
        width: Math.ceil(extent.width * baseZoom),
        height: Math.ceil(extent.height * baseZoom),
      },
    })
  }
  const sheets = Math.ceil(partsAcross / perSheet)
  return { page, zoom: baseZoom, partsAcross, partsDown: 1, parts, pageCount: 1 + sheets, strip: true }
}

/** Where the chart goes on from a part: the page to its right and the page below, if there are any. */
export function continuation(plan: PrintPlan, part: PrintPart): { right?: number; below?: number } {
  const at = (across: number, down: number) => plan.parts.find((other) => other.across === across && other.down === down)?.page
  return { right: at(part.across + 1, part.down), below: at(part.across, part.down + 1) }
}
