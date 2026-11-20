import { forEachBead } from '../domain/canvas'
import type { Rotation } from '../domain/grid'
import { paintedFrameBox, projectDimensions } from '../domain/projectExtent'
import { displayedGrid, planPrint, PRINT_BEAD_MIN_MM, PRINT_BEAD_TWO_LETTER_MM, wholeArea, type PlanOptions, type PrintPart, type PrintPlan, type TrimmedArea } from './printPlan'
import { chartCellOf, customChart, type ChartBead } from './customChart'
import { beadsOfLayer, frameOf, type Layered, quarterTurnOf } from '../domain/layerRecord'
import type { Project } from '../domain/project'

// A chart page's color key (tickets 579, 0585): the colors on the page, the overlap included since it is drawn there, and
// no counts (page 1's Beads needed has them). Its height is set once for the PDF, from the chart page with the most colors.
// And the rows and columns the chart is trimmed to (ticket 1128), read off where the beads land as the key's colors are.

type Counted = Layered & Pick<Project, 'paletteLetters'>

/** Where a bead lands in the displayed chart, across and down from 0. */
function displayedAt(rotation: Rotation, columns: number, rows: number, column: number, row: number): [number, number] {
  switch (rotation) {
    case 90:
      return [rows - 1 - row, column]
    case 180:
      return [columns - 1 - column, rows - 1 - row]
    case 270:
      return [row, columns - 1 - column]
    default:
      return [column, row]
  }
}

/** The colors in the parts' beads, overlap included. */
export function colorsOnPage(project: Counted, parts: readonly PrintPart[]): string[] {
  const frame = frameOf(project)
  if (!frame) return []
  const onPart = (across: number, down: number) => parts.some((part) => across >= part.firstAcross - part.overlapAcross && across <= part.lastAcross && down >= part.firstDown - part.overlapDown && down <= part.lastDown)
  // A Custom frame's beads lie at angles: each counts in the cell its centre falls in (ticket 0594).
  const custom = customChart(project, { x: 0, y: 0, width: 0, height: 0 }, 1)
  if (custom) {
    const { stepAcross, stepDown } = displayedGrid(project)
    return [...new Set(custom.beads.flatMap((bead) => {
      const { across, down } = chartCellOf(bead, stepAcross, stepDown)
      return bead.color && onPart(across, down) ? [bead.color] : []
    }))]
  }
  const { columns, rows } = projectDimensions(project)
  const found = new Set<string>()
  forEachBead(beadsOfLayer(project, 'frame')!, (row, column, hex) => {
    const [across, down] = displayedAt(quarterTurnOf(project), columns, rows, column, row)
    if (onPart(across, down)) {
      found.add(hex)
    }
  })
  return [...found]
}

/** Slack so a bead that ends exactly on a cell's edge does not reach into the next cell. */
const EDGE_SLOP = 1e-6

/** The cells a Custom frame's bead covers, its upright box's top left and bottom right: what the chart is trimmed to, so
 * no bead at its edge is cut. */
function cornerCells(bead: ChartBead, stepAcross: number, stepDown: number): { across: number; down: number }[] {
  const cos = Math.abs(Math.cos(bead.angle))
  const sin = Math.abs(Math.sin(bead.angle))
  const halfAcross = (cos * bead.width + sin * bead.height) / 2
  const halfDown = (sin * bead.width + cos * bead.height) / 2
  return [
    chartCellOf({ x: bead.x - halfAcross, y: bead.y - halfDown }, stepAcross, stepDown),
    chartCellOf({ x: bead.x + halfAcross - EDGE_SLOP, y: bead.y + halfDown - EDGE_SLOP }, stepAcross, stepDown),
  ]
}

/** The rows and columns from the first bead to the last, across and down (ticket 1128; PrintChartPage card): what the PDF
 * and the PNG print, empty positions between beads kept. A Custom frame's are the rectangle round its colored beads; a
 * Schema with no beads prints whole. */
export function trimmedArea(project: Layered): TrimmedArea {
  const whole = wholeArea(project)
  const frame = frameOf(project)
  if (!frame) return whole
  const custom = customChart(project, { x: 0, y: 0, width: 0, height: 0 }, 1)
  let cells: { across: number; down: number }[]
  if (custom) {
    const { stepAcross, stepDown } = displayedGrid(project)
    cells = custom.beads.flatMap((bead) => (bead.color === null ? [] : cornerCells(bead, stepAcross, stepDown)))
  } else {
    const box = paintedFrameBox(project)
    const { columns, rows } = projectDimensions(project)
    const corner = (row: number, column: number) => {
      const [across, down] = displayedAt(quarterTurnOf(project), columns, rows, column, row)
      return { across, down }
    }
    cells = box ? [corner(box.row, box.column), corner(box.row + box.rows - 1, box.column + box.columns - 1)] : []
  }
  if (cells.length === 0) return whole
  const area = { firstAcross: whole.lastAcross, lastAcross: whole.firstAcross, firstDown: whole.lastDown, lastDown: whole.firstDown }
  for (const { across, down } of cells) {
    area.firstAcross = Math.min(area.firstAcross, across)
    area.lastAcross = Math.max(area.lastAcross, across)
    area.firstDown = Math.min(area.firstDown, down)
    area.lastDown = Math.max(area.lastDown, down)
  }
  return {
    firstAcross: Math.max(whole.firstAcross, area.firstAcross),
    lastAcross: Math.min(whole.lastAcross, area.lastAcross),
    firstDown: Math.max(whole.firstDown, area.firstDown),
    lastDown: Math.min(whole.lastDown, area.lastDown),
  }
}

/** Colors in a row of the key (`print-key-columns`). */
export const KEY_COLUMNS = 6

/** The most rows a key may take: past it the key ends in an ellipsis rather than eat the chart. */
const MAX_KEY_ROWS = 10

/** Whether the Schema's colors carry two-letter Swatch letters (more than 26 colors), which need a larger bead. */
function twoLetterMarks(project: Counted, parts: readonly PrintPart[]): boolean {
  const colors = colorsOnPage(project, parts)
  return colors.length > 26 || colors.some((hex) => (project.paletteLetters?.[hex]?.length ?? 1) > 1)
}

/** The plan of the trimmed chart (ticket 1128) with a key as tall as the busiest chart page needs, at a bead two-letter
 * Swatch letters read on (ticket 0913) and never under the floor asked for (Large beads, ticket 0916). The key sets the
 * parts' size, so its rows grow from one until they hold the busiest page; a chart on page 1 has none (ticket 0914). */
export function planWithKey(project: Counted, asked: Omit<PlanOptions, 'keyRows'> = {}): PrintPlan {
  const options = { ...asked, trim: asked.trim ?? trimmedArea(project) }
  const askedFloorMm = Math.max(PRINT_BEAD_MIN_MM, options.floorMm ?? PRINT_BEAD_MIN_MM)
  let plan = planPrint(project, { ...options, floorMm: askedFloorMm })
  const floorMm = twoLetterMarks(project, plan.parts) ? Math.max(askedFloorMm, PRINT_BEAD_TWO_LETTER_MM) : askedFloorMm
  if (floorMm !== askedFloorMm) plan = planPrint(project, { ...options, floorMm })
  for (;;) {
    const sheets = new Map<number, PrintPart[]>()
    for (const part of plan.parts) if (part.page > plan.pageOneNumber) sheets.set(part.page, [...(sheets.get(part.page) ?? []), part])
    const busiest = Math.max(0, ...[...sheets.values()].map((parts) => colorsOnPage(project, parts).length))
    const keyRows = Math.min(MAX_KEY_ROWS, Math.max(1, Math.ceil(busiest / KEY_COLUMNS)))
    if (keyRows <= plan.keyRows) return plan
    plan = planPrint(project, { ...options, keyRows, floorMm })
  }
}
