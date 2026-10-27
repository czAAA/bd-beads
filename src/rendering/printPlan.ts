import { countedDimensions, frameWeave } from '../domain/project'
import { rotationSwapsAxes, type Rotation } from '../domain/grid'
import { describeWeave, type Weave } from '../domain/weave'
import type { Project } from '../domain/project'
import { CELL_SIZE_PX, cellSizePx, displayedExtentPx, rowPitchPx, type Region } from './surfaceView'

// PDF page layout (ticket 162, 185, 578, 0584): the Cover page whole, then parts of as many beads as fill a chart page at
// one bead size, small parts sharing a sheet; page px at 150 dpi.

export const PRINT_DPI = 150
/** Millimetres as page px. */
export function mm(value: number): number {
  return (value * PRINT_DPI) / 25.4
}

/** One bead on every chart page (`print-chart-cell`), a size a weaver can work from (ticket 0584). */
export const PRINT_CHART_CELL_MM = 3
export const PRINT_MARGIN = mm(10)
export const PRINT_HEADER = mm(12)
/** The gap between the header and the first pad. */
export const PRINT_HEADER_GAP = mm(3)
const PRINT_FOOTER = mm(6)
/** The gap between the last pad and the footer's band, and the key's height: 6.5 mm and 4.5 mm a row of colors
 * (PrintChartPage card). */
const PRINT_KEY_GAP = mm(3)
function printKeyHeight(rows: number): number {
  return mm(6.5 + 4.5 * rows)
}
/** The rulers' band on each side of a chart; the cover's board also stands `PRINT_BOARD_PAD` in from its rulers, a chart
 * page's pad does not. */
export const PRINT_RULER = mm(5)
export const PRINT_BOARD_PAD = mm(2.5)
/** Room for a part's own "part B · columns 101–130 · rows 1–100" label above its pad when parts share a sheet
 * (PrintStrips card); `PRINT_PART_GAP` is the gap between pads. */
export const PRINT_PART_LABEL = mm(5)
const PRINT_PART_GAP = mm(6)

export interface PageSize {
  width: number
  height: number
}

/** A4 portrait at 150 dpi: every page of the PDF. */
export const A4_PORTRAIT: PageSize = { width: 1240, height: 1754 }

/** What a chart page leaves for its pads: inside the margins, header, color key of `keyRows` rows and footer. */
export function chartArea(page: PageSize, keyRows = 1): PageSize {
  return {
    width: page.width - PRINT_MARGIN * 2,
    height: page.height - PRINT_MARGIN * 2 - PRINT_HEADER - PRINT_HEADER_GAP - PRINT_FOOTER - PRINT_KEY_GAP - printKeyHeight(keyRows),
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
  /** Its pad (rulers and beads) and, where the sheet is shared, the label above it, as one box from the top left of the page's chart area, in px. */
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
  /** How many rows of colors the key under the pads has room for, the same on every chart page. */
  keyRows: number
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

/** How many beads of a side fill `room` px at `zoom`, or the whole `total` when they all fit. */
function beadsThatFit(extentOf: (beads: number) => number, zoom: number, room: number, total: number): number {
  const fits = (beads: number) => extentOf(beads) * zoom <= room + FIT_SLOP / 2 /* half a px: A4 is 1240.2 px, and the page is 1240 */
  let beads = 1
  while (beads < total && fits(beads + 1)) beads += 1
  return beads
}

/** The beads each part owns along a side that holds `full` beads: the first fills the side, the rest give `print-part-overlap`
 * of it to the beads they repeat from the part before ("60 + 40" for a 100 side, PrintChartPage card). */
function cutSide(total: number, full: number): { first: number; last: number }[] {
  const cuts = [{ first: 0, last: Math.min(total, full) - 1 }]
  while (cuts.at(-1)!.last < total - 1) {
    const first = cuts.at(-1)!.last + 1
    cuts.push({ first, last: Math.min(total, first + Math.max(1, full - PRINT_PART_OVERLAP)) - 1 })
  }
  return cuts
}

/** Cuts the displayed chart into parts of the most beads a chart page holds across and down (3 mm a bead, rulers and
 * overlap included), from the top left, and lays them on sheets in reading order (tickets 578, 0584). */
export function planPrint(project: Shape, page: PageSize = A4_PORTRAIT, listPages = 0, keyRows = 1): PrintPlan {
  const grid = displayedGrid(project)
  const zoom = mm(PRINT_CHART_CELL_MM) / CELL_SIZE_PX
  const inset = PRINT_RULER
  const area = chartArea(page, keyRows)
  // Two rows (columns) are counted so a brick or peyote part's half-bead offset is in the width (height).
  const fullAcross = beadsThatFit((beads) => blockExtent(project, project.rotation, beads, 2).width, zoom, area.width - inset * 2, grid.across)
  const fullDown = beadsThatFit((beads) => blockExtent(project, project.rotation, 2, beads).height, zoom, area.height - inset * 2, grid.down)
  const sidesAcross = cutSide(grid.across, fullAcross)
  const sidesDown = cutSide(grid.down, fullDown)
  const partsAcross = sidesAcross.length
  const partsDown = sidesDown.length

  const cut: Omit<PrintPart, 'page' | 'place'>[] = []
  for (let down = 0; down < partsDown; down += 1) {
    for (let across = 0; across < partsAcross; across += 1) {
      const { first: firstAcross, last: lastAcross } = sidesAcross[across]!
      const { first: firstDown, last: lastDown } = sidesDown[down]!
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

  // Each box holds room for the label a shared sheet puts above its pad; a pad as tall as the sheet has none to spare and
  // is alone on it.
  const sizes = cut.map(({ region }) => ({ width: region.width + inset * 2, height: Math.min(region.height + inset * 2 + PRINT_PART_LABEL, area.height) }))
  const placed = packSheets(sizes, area)
  const parts = cut.map((part, index) => {
    const { sheet, x, y } = placed[index]!
    const size = sizes[index]!
    return { ...part, page: sheet + 2 + listPages, place: { x, y, ...size } }
  })
  const sheets = placed.reduce((most, { sheet }) => Math.max(most, sheet + 1), 0)
  return { page, zoom, partsAcross, partsDown, parts, specificationPage: 2 + sheets + listPages, pageCount: 2 + sheets + listPages, keyRows }
}

/** Where the chart goes on from a part: the page to its right and the page below, if there are any. */
export function continuation(plan: PrintPlan, part: PrintPart): { right?: number; below?: number } {
  const at = (across: number, down: number) => plan.parts.find((other) => other.across === across && other.down === down)?.page
  return { right: at(part.across + 1, part.down), below: at(part.across, part.down + 1) }
}
