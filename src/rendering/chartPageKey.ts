import { forEachBead } from '../domain/canvas'
import type { Rotation } from '../domain/grid'
import { countedDimensions } from '../domain/projectExtent'
import { frameWeave } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import { describeWeave } from '../domain/weave'
import { displayedGrid, planPrint, type PrintPart, type PrintPlan } from './printPlan'
import { chartCellOf, customChart } from './customChart'

// A chart page's color key (tickets 579, 0585): the colors on the page, the overlap included since it is drawn there, and
// no counts (the Specification has the totals). Its height is set once for the PDF, from the page with the most colors.

type Counted = Pick<Project, 'frame' | 'beads' | 'rotation' | 'technique' | 'brickBlock' | 'netSize'>

/** Where a bead (a Unit's, for the Units techniques) lands in the displayed chart, across and down from 0. */
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
  const { frame } = project
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
  const weave = describeWeave(frameWeave(project))
  const { columns, rows } = countedDimensions(project)
  const found = new Set<string>()
  forEachBead(frame.beads, (row, column, hex) => {
    if (!weave.hasPosition({ row, column }, { ...frame, row: 0, column: 0 })) return
    const [across, down] = displayedAt(project.rotation, columns, rows, Math.floor(column / weave.columnsPerUnit), Math.floor(row / weave.rowsPerUnit))
    if (onPart(across, down)) {
      found.add(hex)
    }
  })
  return [...found]
}

/** Colors in a row of the key (`print-key-columns`). */
export const KEY_COLUMNS = 6

/** The most rows a key may take: past it the key ends in an ellipsis rather than eat the chart. */
const MAX_KEY_ROWS = 10

/** The plan with a key tall enough for the chart page with the most colors. The key's height sets the parts' size, which
 * sets the colors per page, so the rows grow from one until they hold the busiest page. */
export function planWithKey(project: Parameters<typeof planPrint>[0] & Counted, listPages = 0): PrintPlan {
  let plan = planPrint(project, undefined, listPages, 1)
  for (;;) {
    const sheets = new Map<number, PrintPart[]>()
    for (const part of plan.parts) sheets.set(part.page, [...(sheets.get(part.page) ?? []), part])
    const busiest = Math.max(0, ...[...sheets.values()].map((parts) => colorsOnPage(project, parts).length))
    const rows = Math.min(MAX_KEY_ROWS, Math.max(1, Math.ceil(busiest / KEY_COLUMNS)))
    if (rows <= plan.keyRows) return plan
    plan = planPrint(project, undefined, listPages, rows)
  }
}
