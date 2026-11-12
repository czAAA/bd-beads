import { projectDimensions } from '../domain/projectExtent'
import { frameWeave } from '../domain/layerWeave'
import { rotationSwapsAxes, type Rotation } from '../domain/grid'
import type { Weave } from '../domain/weave'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import { displayedExtentPx, beadStepPx, type Region } from './surfaceView'
import { heldWeave, type Layered, quarterTurnOf } from '../domain/layerRecord'

// PDF page layout (tickets 162, 185, 578, 0584, 0913, 0914): the chart whole on page 1 when it fits there, else page 1 is the
// overview and equal parts follow, at the largest bead the sheets allow and the same on every chart page; page px at 150 dpi.

export const PRINT_DPI = 150
/** Millimetres as page px. */
export function mm(value: number): number {
  return (value * PRINT_DPI) / 25.4
}

/** The chart's bead (ticket 0913, PrintChartPage card): at least `print-bead-min`, or `print-bead-stretch` only to keep the
 * whole Schema on one sheet, and at most `print-bead-max`; a PDF of several chart pages keeps its bead to 3 mm. */
export const PRINT_BEAD_MIN_MM = 1.8
/** @internal The token test holds it to `print-bead-stretch`. */
export const PRINT_BEAD_STRETCH_MM = 1.6
/** @internal The token test holds it to `print-bead-max`. */
export const PRINT_BEAD_MAX_MM = 9
const PART_BEAD_MAX_MM = 3
/** The smallest bead with Large beads on (ticket 0916, `print-bead-large`): the chart size before ticket 0913. */
export const PRINT_BEAD_LARGE_MM = 3
/** Two-letter Swatch letters (more than 26 colors) do not read on a smaller bead. */
export const PRINT_BEAD_TWO_LETTER_MM = 2.2
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

/** What a chart page leaves for its pads: inside the margins, header, color key of `keyRows` rows and footer.
 * @internal Its test checks what a chart page leaves on its own. */
export function chartArea(page: PageSize, keyRows = 1): PageSize {
  return {
    width: page.width - PRINT_MARGIN * 2,
    height: page.height - PRINT_MARGIN * 2 - PRINT_HEADER - PRINT_HEADER_GAP - PRINT_FOOTER - PRINT_KEY_GAP - printKeyHeight(keyRows),
  }
}

export interface PrintPart {
  /** The page it prints on: 1 when the chart is whole on page 1 (ticket 0914), else a chart page after page 1 and its list
   * pages; small parts share one. */
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
  /** Its pad (rulers and beads) and, where the sheet is shared, the label above it, as one box from the top left of the
   * page's chart area (page 1's when it is on page 1), in px. */
  place: Region
}

export interface PrintPlan {
  /** Always A4 portrait (printed-output.md, Wide and long Schemas). */
  page: PageSize
  /** One bead is CELL_SIZE_PX × zoom px on every chart page, `beadMm` millimetres. */
  zoom: number
  beadMm: number
  partsAcross: number
  partsDown: number
  parts: PrintPart[]
  /** Every page of the PDF but the Word chart's: page 1, its list pages and the chart pages (ticket 0914). */
  pageCount: number
  /** How many rows of colors the key under the pads has room for, the same on every chart page. */
  keyRows: number
}

type Shape = Layered

// Beads across and down as the Project shows (turned, its rows run across at a quarter turn), and one bead's step each
// way at zoom 1.
export function displayedGrid(project: Shape) {
  const rotation = quarterTurnOf(project)
  const weave = frameWeave(project)
  const { columns, rows } = projectDimensions(project)
  const step = beadStepPx(weave)
  const cell = cellSizePx(weave.technique, weave.cell)
  return rotationSwapsAxes(rotation)
    ? { across: rows, down: columns, stepAcross: step.down, stepDown: step.across, beadAcross: cell.height, beadDown: cell.width }
    : { across: columns, down: rows, stepAcross: step.across, stepDown: step.down, beadAcross: cell.width, beadDown: cell.height }
}

/** The displayed size of a block of beads `across` × `down`, at zoom 1. */
function blockExtent(weave: Weave, rotation: Rotation, across: number, down: number): PageSize {
  const { columns, rows } = rotationSwapsAxes(rotation) ? { columns: down, rows: across } : { columns: across, rows: down }
  return displayedExtentPx(weave.technique, columns, rows, 1, rotation, weave.cell)
}

/** Columns or rows of the part before it that a part repeats, shaded, so the sheets line up (`print-part-overlap`).
 * @internal Its test holds the overlap to the token. */
export const PRINT_PART_OVERLAP = 2

/** A, B ... Z, AA, AB ...: a part's name from its place in reading order.
 * @internal Its test checks the naming past Z. */
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
 * a small part fills a gap on an earlier sheet). A sheet's last shelf grows for a taller box where the sheet has room,
 * so a strip that repeats rows of the one before still stands beside it. A box too big for an empty sheet still gets one. */
function packSheets(sizes: PageSize[], area: PageSize): { sheet: number; x: number; y: number }[] {
  const sheets: Shelf[][] = []
  return sizes.map((size) => {
    for (const [sheet, shelves] of sheets.entries()) {
      for (const shelf of shelves) {
        const tall = shelf === shelves.at(-1) ? area.height - shelf.y : shelf.height
        if (shelf.used + size.width <= area.width + FIT_SLOP && size.height <= tall + FIT_SLOP) {
          const x = shelf.used
          shelf.used += size.width + PRINT_PART_GAP
          shelf.height = Math.max(shelf.height, size.height)
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

interface Span {
  first: number
  last: number
}

/** How the chart is cut: the beads each part owns along each side. */
interface Cut {
  across: Span[]
  down: Span[]
}

/** `count` parts of a side of `total` beads, as equal as whole beads allow: a 150 side is "75 + 75", never "100 + 50"
 * (ticket 0913). Each part but the first also repeats `print-part-overlap` beads of the one before. */
function cutSide(total: number, count: number): Span[] {
  return Array.from({ length: count }, (_, index) => ({ first: Math.round((total * index) / count), last: Math.round((total * (index + 1)) / count) - 1 }))
}

/** Where a cut prefers to fall: on a ruler's ten, the heavy line. */
const CUT_STEP = 10

/** The same cuts moved to the nearest multiple of `CUT_STEP`, or none when they are there already or a part would be
 * left under half the size of another. */
function snappedSide(sides: Span[], total: number): Span[] | undefined {
  const edges = [0, ...sides.slice(1).map((side) => Math.round(side.first / CUT_STEP) * CUT_STEP), total]
  const owned = sides.map((_, index) => edges[index + 1]! - edges[index]!)
  if (owned.some((beads) => beads * 2 < Math.max(...owned))) return undefined
  if (sides.every((side, index) => side.first === edges[index])) return undefined
  return sides.map((_, index) => ({ first: edges[index]!, last: edges[index + 1]! - 1 }))
}

/** A part as cut, with where it sits in the whole chart at zoom 1, its overlap included. */
type Block = Omit<PrintPart, 'page' | 'place'>

function blocksOf(project: Shape, cut: Cut): Block[] {
  const grid = displayedGrid(project)
  // Measured in the Canvas's Weave as held, without its Bead's cell.
  const canvas = heldWeave(project, 'canvas')
  const blocks: Block[] = []
  cut.down.forEach(({ first: firstDown, last: lastDown }, down) => {
    cut.across.forEach(({ first: firstAcross, last: lastAcross }, across) => {
      const overlapAcross = Math.min(PRINT_PART_OVERLAP, firstAcross)
      const overlapDown = Math.min(PRINT_PART_OVERLAP, firstDown)
      const extent = blockExtent(canvas, quarterTurnOf(project), lastAcross - firstAcross + 1 + overlapAcross, lastDown - firstDown + 1 + overlapDown)
      const region = { x: (firstAcross - overlapAcross) * grid.stepAcross, y: (firstDown - overlapDown) * grid.stepDown, ...extent }
      blocks.push({ across, down, letter: partLetter(blocks.length), firstAcross, lastAcross, firstDown, lastDown, overlapAcross, overlapDown, region })
    })
  })
  return blocks
}

/** A block's region at `zoom`, whole px across and down. */
function regionAt(block: Block, zoom: number): Region {
  const { x, y, width, height } = block.region
  return { x: x * zoom, y: y * zoom, width: Math.ceil(width * zoom), height: Math.ceil(height * zoom) }
}

/** The largest zoom at which every block, with its rulers, fits a chart area on its own. */
function largestZoom(blocks: Block[], area: PageSize): number {
  const room = { width: area.width - PRINT_RULER * 2, height: area.height - PRINT_RULER * 2 }
  return Math.min(...blocks.map(({ region }) => Math.min(room.width / region.width, room.height / region.height)))
}

/** Each block's box on a sheet at `zoom`: its pad and room for the label a shared sheet puts above it; a pad as tall as
 * the sheet has none to spare and is alone on it. */
function boxesAt(blocks: Block[], zoom: number, area: PageSize): PageSize[] {
  return blocks.map((block) => {
    const { width, height } = regionAt(block, zoom)
    return { width: width + PRINT_RULER * 2, height: Math.min(height + PRINT_RULER * 2 + PRINT_PART_LABEL, area.height) }
  })
}

/** How many sheets packed boxes take. */
function sheetCount(placed: { sheet: number }[]): number {
  return placed.reduce((most, { sheet }) => Math.max(most, sheet + 1), 0)
}

function sheetsAt(blocks: Block[], zoom: number, area: PageSize): number {
  return sheetCount(packSheets(boxesAt(blocks, zoom, area), area))
}

/** Halvings of the search for the largest bead: far finer than a print can show. */
const SEARCH_STEPS = 16

/** The largest zoom in `low`–`high` that `holds`, or none when not even `low` does. */
function largestWhere(holds: (zoom: number) => boolean, low: number, high: number): number | undefined {
  if (!holds(low)) return undefined
  if (holds(high)) return high
  let [yes, no] = [low, high]
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (yes + no) / 2
    if (holds(middle)) yes = middle
    else no = middle
  }
  return yes
}

/** One way to print the chart: its cut, its bead, whether it is page 1's own chart, and the pages it takes (page 1 counted). */
interface Choice {
  cut: Cut
  zoom: number
  onPageOne: boolean
  sheets: number
}

/** How a PDF is planned: its page, the list pages Beads needed continues on after page 1, the rows of the chart pages'
 * key, the smallest bead, and the room page 1 leaves its chart (ticket 0914; none: a chart page's). */
export interface PlanOptions {
  page?: PageSize
  listPages?: number
  keyRows?: number
  floorMm?: number
  pageOne?: PageSize
}

/** Whether the plan puts the whole chart on page 1, so the PDF needs no chart pages (ticket 0914). */
export function chartOnPageOne(plan: PrintPlan): boolean {
  return plan.parts.every((part) => part.page === 1)
}

/** The most strips a long narrow Schema is folded into, and the further part counts tried past the fewest that fit. */
const MOST_STRIPS = 16
const MORE_PARTS = 3
/** A bead gain too small to see on paper: a plan of more parts must beat a plan of fewer by more than this. */
const BEAD_GAIN_MM = 0.05

/** How the chart is printed (tickets 0913, 0914; printed-output.md, Chart pages): whole on page 1 at `print-bead-stretch` or
 * more, or folded into strips there, else page 1 is the overview and equal parts follow on the fewest sheets that keep the
 * bead at `floorMm` or more, then at the largest bead they allow; cuts on a multiple of 10 where the parts still fit. */
export function planPrint(project: Shape, options: PlanOptions = {}): PrintPlan {
  const { page = A4_PORTRAIT, listPages = 0, keyRows = 1, floorMm = PRINT_BEAD_MIN_MM } = options
  const grid = displayedGrid(project)
  const area = chartArea(page, keyRows)
  const first = options.pageOne ?? area
  const areaOf = (choice: { onPageOne: boolean }) => (choice.onPageOne ? first : area)
  const zoomOf = (beadMm: number) => mm(beadMm) / CELL_SIZE_PX
  // A raised floor (two-letter Swatch letters) has no stretch.
  const stretch = floorMm > PRINT_BEAD_MIN_MM ? floorMm : Math.min(floorMm, PRINT_BEAD_STRETCH_MM)
  const floor = zoomOf(floorMm)
  const cutInto = (across: number, down: number): Cut => ({ across: cutSide(grid.across, across), down: cutSide(grid.down, down) })
  const choices: Choice[] = []

  // The whole Schema on page 1, down to the stretch.
  const whole = cutInto(1, 1)
  const wholeZoom = Math.min(zoomOf(PRINT_BEAD_MAX_MM), largestZoom(blocksOf(project, whole), first))
  if (wholeZoom >= zoomOf(stretch)) choices.push({ cut: whole, zoom: wholeZoom, onPageOne: true, sheets: 1 })

  // A Schema under a part page's bead whole may fold into strips side by side, or stacked, on page 1.
  const onOneSheet = (blocks: Block[]) => (zoom: number) => zoom <= largestZoom(blocks, first) && sheetsAt(blocks, zoom, first) === 1
  if (wholeZoom < zoomOf(PART_BEAD_MAX_MM)) {
    for (let count = 2; count <= MOST_STRIPS; count += 1) {
      for (const cut of [count <= grid.down ? cutInto(1, count) : undefined, count <= grid.across ? cutInto(count, 1) : undefined]) {
        if (!cut) continue
        const zoom = largestWhere(onOneSheet(blocksOf(project, cut)), floor, zoomOf(PRINT_BEAD_MAX_MM))
        if (zoom !== undefined) choices.push({ cut, zoom, onPageOne: true, sheets: 1 })
      }
    }
  }

  // Equal parts on chart pages after page 1, each at the largest bead a sheet allows up to a part page's; small parts share one.
  const partCap = zoomOf(Math.max(PART_BEAD_MAX_MM, floorMm))
  const fewest = (total: number, fits: (count: number) => boolean) => {
    let count = 1
    while (count < total && !fits(count)) count += 1
    return count
  }
  const fewestAcross = fewest(grid.across, (count) => largestZoom(blocksOf(project, cutInto(count, 1)), { width: area.width, height: Infinity }) >= floor)
  const fewestDown = fewest(grid.down, (count) => largestZoom(blocksOf(project, cutInto(1, count)), { width: Infinity, height: area.height }) >= floor)
  for (let across = fewestAcross; across <= Math.min(grid.across, fewestAcross + MORE_PARTS); across += 1) {
    for (let down = fewestDown; down <= Math.min(grid.down, fewestDown + MORE_PARTS); down += 1) {
      if (across * down === 1) continue
      const cut = cutInto(across, down)
      const blocks = blocksOf(project, cut)
      const zoom = Math.min(partCap, largestZoom(blocks, area))
      if (zoom >= floor) choices.push({ cut, zoom, onPageOne: false, sheets: 1 + sheetsAt(blocks, zoom, area) })
    }
  }

  // The fewest pages, then the largest bead, and of beads alike the fewest parts.
  const partsIn = (choice: Choice) => choice.cut.across.length * choice.cut.down.length
  const best = [...choices].sort((a, b) => partsIn(a) - partsIn(b)).reduce<Choice | undefined>((most, choice) =>
    !most || choice.sheets < most.sheets || (choice.sheets === most.sheets && choice.zoom > most.zoom + zoomOf(BEAD_GAIN_MM)) ? choice : most, undefined)
    ?? { cut: whole, zoom: wholeZoom, onPageOne: true, sheets: 1 }
  const room = areaOf(best)

  // Cuts on a multiple of 10 where the parts still fit at that bead on as many sheets.
  let { cut } = best
  const keeps = (tried: Cut) => {
    const blocks = blocksOf(project, tried)
    return best.zoom <= largestZoom(blocks, room) && sheetsAt(blocks, best.zoom, room) === best.sheets - (best.onPageOne ? 0 : 1)
  }
  const across = snappedSide(cut.across, grid.across)
  if (across && keeps({ ...cut, across })) cut = { ...cut, across }
  const down = snappedSide(cut.down, grid.down)
  if (down && keeps({ ...cut, down })) cut = { ...cut, down }

  const { zoom } = best
  const blocks = blocksOf(project, cut)
  const sizes = boxesAt(blocks, zoom, room)
  const placed = packSheets(sizes, room)
  const sheets = sheetCount(placed)
  // A Schema whole on one sheet is centred across it (a small one at the largest bead); parts keep the left margin.
  const centred = blocks.length === 1
  const parts = blocks.map((block, index) => {
    const { sheet, x, y } = placed[index]!
    const size = sizes[index]!
    const onPage = best.onPageOne ? 1 : sheet + 2 + listPages
    return { ...block, region: regionAt(block, zoom), page: onPage, place: { x: centred ? Math.max(0, (room.width - size.width) / 2) : x, y, ...size } }
  })
  const pageCount = 1 + listPages + (best.onPageOne ? 0 : sheets)
  return { page, zoom, beadMm: (zoom * CELL_SIZE_PX) / mm(1), partsAcross: cut.across.length, partsDown: cut.down.length, parts, pageCount, keyRows }
}

/** Where the chart goes on from a part: the page to its right and the page below, if there are any. */
export function continuation(plan: PrintPlan, part: PrintPart): { right?: number; below?: number } {
  const at = (across: number, down: number) => plan.parts.find((other) => other.across === across && other.down === down)?.page
  return { right: at(part.across + 1, part.down), below: at(part.across, part.down + 1) }
}
