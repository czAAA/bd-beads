import { countedDimensions, frameWeave } from '../domain/project'
import { rotationSwapsAxes, type Rotation } from '../domain/grid'
import { describeWeave, type Weave } from '../domain/weave'
import type { Project } from '../domain/project'
import { CELL_SIZE_PX, cellSizePx, displayedExtentPx, rowPitchPx, type Region } from './surfaceView'

// PDF page layout (ticket 162, 185, 578): the Cover page whole, then parts of at most 100 × 100 beads at one bead size, small
// parts sharing a sheet; page px at 150 dpi.

export const PRINT_DPI = 150
/** Millimetres as page px. */
export function mm(value: number): number {
  return (value * PRINT_DPI) / 25.4
}

/** One bead on every chart page (`print-chart-cell`), or with Letters on, `print-chart-cell-letters`. */
export const PRINT_CHART_CELL_MM = 1.75
export const PRINT_CHART_CELL_LETTERS_MM = 2.3
export const PRINT_MARGIN = mm(10)
export const PRINT_HEADER = mm(17)
const PRINT_FOOTER = mm(8)
/** The rulers' band on each side of a chart, and the board's own edge around the beads. */
export const PRINT_RULER = mm(5)
export const PRINT_BOARD_PAD = mm(2.5)
/** Room for a part's own "Part B · columns 101–130 · rows 1–100" label above its board, and the gap between boards. */
export const PRINT_PART_LABEL = mm(5)
const PRINT_PART_GAP = mm(1)

export interface PageSize {
  width: number
  height: number
}

/** A4 portrait at 150 dpi: every page of the PDF. */
export const A4_PORTRAIT: PageSize = { width: 1240, height: 1754 }

/** What a chart page leaves for its boards: inside the margins, header and footer. */
export function chartArea(page: PageSize): PageSize {
  return {
    width: page.width - PRINT_MARGIN * 2,
    height: page.height - PRINT_MARGIN * 2 - PRINT_HEADER - PRINT_FOOTER,
  }
}

export interface PrintPart {
  /** The page it prints on (page 1 is the whole Project); small parts share one. */
  page: number
  /** Which part across and down, from 0. */
  across: number
  down: number
  /** Its name in reading order: A, B, C ... Z, AA. */
  letter: string
  /** The displayed beads it holds, across and down, from 0 (a turned Project's rows run across). */
  firstAcross: number
  lastAcross: number
  firstDown: number
  lastDown: number
  /** The beads of the part before it that it repeats at its left and its top (0 on the first part's outer edges). */
  overlapAcross: number
  overlapDown: number
  /** Where it sits in the whole displayed chart at the plan's zoom, in px, its overlap included. */
  region: Region
  /** Its label, rulers and board as one box, from the top left of the page's chart area, in px. */
  place: Region
}

export interface PrintPlan {
  /** Always A4 portrait (printed-output.md, Wide and long Schemas). */
  page: PageSize
  /** One bead is CELL_SIZE_PX × zoom px on every chart page. */
  zoom: number
  partsAcross: number
  partsDown: number
  parts: PrintPart[]
  /** The page the Specification is on: the one after the last chart page (ticket 0581). */
  specificationPage: number
  /** Every page of the PDF up to and including the Specification; the Word chart's sheets are counted on top. */
  pageCount: number
}

type Shape = Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'frame' | 'beads' | 'rotation'> & Partial<Pick<Project, 'beadId' | 'beadShape' | 'letters'>>

// Beads across and down as the Project shows (turned, its rows run across at a quarter turn), and one bead's step each
// way at zoom 1.
export function displayedGrid(project: Shape) {
  const { rotation } = project
  const weave = frameWeave(project)
  const { technique } = weave
  const { columns, rows } = countedDimensions(project)
  // Techniques that count Units step a whole Unit across and down (tickets 482, 485).
  const description = describeWeave(weave)
  const cell = cellSizePx(technique, weave.cell)
  const unit = description.countsUnits
    ? { across: description.origin({ row: 0, column: description.columnsPerUnit }, cell.width, cell.height).x, down: description.origin({ row: description.rowsPerUnit, column: 0 }, cell.width, cell.height).y }
    : undefined
  const pitch = unit?.down ?? rowPitchPx(technique, weave.cell)
  const wide = unit?.across ?? CELL_SIZE_PX
  const tall = unit ? wide : cell.height
  return rotationSwapsAxes(rotation)
    ? { across: rows, down: columns, stepAcross: pitch, stepDown: wide, beadAcross: tall, beadDown: wide }
    : { across: columns, down: rows, stepAcross: wide, stepDown: pitch, beadAcross: wide, beadDown: tall }
}

/** The displayed size of a block of beads `across` × `down`, at zoom 1. */
function blockExtent(weave: Weave, rotation: Rotation, across: number, down: number): PageSize {
  const counted = rotationSwapsAxes(rotation) ? { columns: down, rows: across } : { columns: across, rows: down }
  const { columns, rows } = describeWeave(weave).positionsOf(counted)
  return displayedExtentPx(weave.technique, columns, rows, 1, rotation, weave.cell)
}

/** A chart part's side, fixed (ticket 185): 100 beads, an edge part simply however many remain. */
export const PRINT_BLOCK_BEADS = 100
/** With Letters on a part holds at most this many beads a side, so a letter keeps room (`print-part-beads-letters`). */
export const PRINT_BLOCK_BEADS_LETTERS = 75

/** Columns or rows of the part before it that a part repeats, shaded, so the sheets line up (`print-part-overlap`). */
export const PRINT_PART_OVERLAP = 2

/** A, B ... Z, AA, AB ...: a part's name from its place in reading order. */
export function partLetter(index: number): string {
  let name = ''
  for (let rest = index; rest >= 0; rest = Math.floor(rest / 26) - 1) name = String.fromCharCode(65 + (rest % 26)) + name
  return name
}

/** Slack for the rounding of a board that exactly fills a sheet. */
const FIT_SLOP = 1

interface Shelf {
  y: number
  height: number
  used: number
}

/** Puts boxes on sheets: left to right along a shelf, a new shelf below, a new sheet when none has room (first fit, so
 * a small part fills a gap on an earlier sheet). A box too big for an empty sheet still gets one. */
function packSheets(sizes: PageSize[], area: PageSize): { sheet: number; x: number; y: number }[] {
  const sheets: Shelf[][] = []
  return sizes.map((size) => {
    for (const [sheet, shelves] of sheets.entries()) {
      for (const shelf of shelves) {
        if (shelf.used + size.width <= area.width + FIT_SLOP && size.height <= shelf.height + FIT_SLOP) {
          const x = shelf.used
          shelf.used += size.width + PRINT_PART_GAP
          return { sheet, x, y: shelf.y }
        }
      }
      const last = shelves.at(-1)
      const y = last ? last.y + last.height + PRINT_PART_GAP : 0
      if (y + size.height <= area.height + FIT_SLOP) {
        shelves.push({ y, height: size.height, used: size.width + PRINT_PART_GAP })
        return { sheet, x: 0, y }
      }
    }
    sheets.push([{ y: 0, height: size.height, used: size.width + PRINT_PART_GAP }])
    return { sheet: sheets.length - 1, x: 0, y: 0 }
  })
}

/** Cuts the displayed chart into parts of at most 100 × 100 beads (75 with Letters on) from the top left, every one at
 * one bead size, and lays them on sheets in reading order (ticket 578). */
export function planPrint(project: Shape, page: PageSize = A4_PORTRAIT, listPages = 0): PrintPlan {
  const grid = displayedGrid(project)
  const zoom = mm(project.letters ? PRINT_CHART_CELL_LETTERS_MM : PRINT_CHART_CELL_MM) / CELL_SIZE_PX
  const block = project.letters ? PRINT_BLOCK_BEADS_LETTERS : PRINT_BLOCK_BEADS
  const partsAcross = Math.ceil(grid.across / block)
  const partsDown = Math.ceil(grid.down / block)
  const inset = PRINT_RULER + PRINT_BOARD_PAD

  const cut: Omit<PrintPart, 'page' | 'place'>[] = []
  for (let down = 0; down < partsDown; down += 1) {
    for (let across = 0; across < partsAcross; across += 1) {
      const firstAcross = across * block
      const firstDown = down * block
      const lastAcross = Math.min(grid.across, firstAcross + block) - 1
      const lastDown = Math.min(grid.down, firstDown + block) - 1
      const overlapAcross = Math.min(PRINT_PART_OVERLAP, firstAcross)
      const overlapDown = Math.min(PRINT_PART_OVERLAP, firstDown)
      const extent = blockExtent(project, project.rotation, lastAcross - firstAcross + 1 + overlapAcross, lastDown - firstDown + 1 + overlapDown)
      cut.push({
        across,
        down,
        letter: partLetter(cut.length),
        firstAcross,
        lastAcross,
        firstDown,
        lastDown,
        overlapAcross,
        overlapDown,
        region: {
          x: (firstAcross - overlapAcross) * grid.stepAcross * zoom,
          y: (firstDown - overlapDown) * grid.stepDown * zoom,
          width: Math.ceil(extent.width * zoom),
          height: Math.ceil(extent.height * zoom),
        },
      })
    }
  }

  const sizes = cut.map(({ region }) => ({ width: region.width + inset * 2, height: region.height + inset * 2 + PRINT_PART_LABEL }))
  const placed = packSheets(sizes, chartArea(page))
  const parts = cut.map((part, index) => {
    const { sheet, x, y } = placed[index]!
    const size = sizes[index]!
    // A part with its overlap can pass the sheet's width by a few beads: it stays centered, using the margins evenly.
    const overflow = Math.max(0, size.width - chartArea(page).width)
    return { ...part, page: sheet + 2 + listPages, place: { x: x - overflow / 2, y, ...size } }
  })
  const sheets = placed.reduce((most, { sheet }) => Math.max(most, sheet + 1), 0)
  return { page, zoom, partsAcross, partsDown, parts, specificationPage: 2 + sheets + listPages, pageCount: 2 + sheets + listPages }
}

/** Where the chart goes on from a part: the page to its right and the page below, if there are any. */
export function continuation(plan: PrintPlan, part: PrintPart): { right?: number; below?: number } {
  const at = (across: number, down: number) => plan.parts.find((other) => other.across === across && other.down === down)?.page
  return { right: at(part.across + 1, part.down), below: at(part.across, part.down + 1) }
}
