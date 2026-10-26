import { forEachBead } from '../domain/canvas'
import type { Rotation } from '../domain/grid'
import { countedDimensions, frameWeave, type Project } from '../domain/project'
import { describeWeave } from '../domain/weave'
import type { PrintPart } from './printPlan'

// A chart page's color key (ticket 579): how many beads of each color the parts on the page own. The overlap is the
// previous part's beads again, so it is not counted.

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

/** The beads of each color in the parts' own beads (not their overlap), most first. */
export function colorsOnParts(project: Counted, parts: readonly PrintPart[]): { hex: string; count: number }[] {
  const { frame } = project
  if (!frame) return []
  const weave = describeWeave(frameWeave(project))
  const { columns, rows } = countedDimensions(project)
  const counts = new Map<string, number>()
  forEachBead(frame.beads, (row, column, hex) => {
    if (!weave.hasPosition({ row, column }, { ...frame, row: 0, column: 0 })) return
    const [across, down] = displayedAt(project.rotation, columns, rows, Math.floor(column / weave.columnsPerUnit), Math.floor(row / weave.rowsPerUnit))
    if (parts.some((part) => across >= part.firstAcross && across <= part.lastAcross && down >= part.firstDown && down <= part.lastDown)) {
      counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
  })
  return [...counts.entries()].map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex))
}
