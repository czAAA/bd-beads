import { isFrameLayer } from '../domain/grid'
import { withLaidTurn } from '../domain/framePlacement'
import { withFrameSheet } from '../domain/frameSheet'
import { frameById } from '../domain/layerRecord'
import type { Project } from '../domain/project'
import { selectionExportProject } from '../domain/selectionExport'
import { selectionLayer, type Selection } from '../domain/selection'
import { trimmedArea } from './chartPageKey'
import { displayedCellOf } from './printPages'

/** The Project to export for a Selection (ticket 1210; ExportPanel card): `selectionExportProject`'s part, and for a part
 * of the Frame its numbers going on from the whole chart's, so rows 12-20 print 12...20 as the full chart's do. A part of
 * the Canvas counts from 1 at its top left as seen, having no chart to match. None where a Selection can't be exported. */
export function selectionPart(project: Project, selection: Selection, partName: string): Project | undefined {
  const part = selectionExportProject(project, selection, partName)
  const layer = selectionLayer(project, selection)
  if (!part || !isFrameLayer(layer)) return part
  const ref = layer
  const whole = withLaidTurn(project, undefined, ref)
  const first = frameById(whole, ref)!
  const cut = frameById(part, ref)!
  const row = cut.row - first.row
  const column = cut.column - first.column
  const corners = [displayedCellOf(whole, { row, column }, ref), displayedCellOf(whole, { row: row + cut.rows - 1, column: column + cut.columns - 1 }, ref)]
  const origin = { across: Math.min(...corners.map((corner) => corner.across)), down: Math.min(...corners.map((corner) => corner.down)) }
  const chart = trimmedArea(whole, ref)
  return withFrameSheet(part, { ...cut, numberFrom: { across: chart.firstAcross - origin.across, down: chart.firstDown - origin.down } }, { frame: ref })
}
