import { colorAt, withColors, type BeadChange } from './canvas'
import { layerSheet, onLayer, positionOnCanvas } from './layers'
import { counterparts, isMirrorOn, type MirrorSetting } from './mirror'
import type { Project } from './project'
import { finishedRowsOf } from './rowProgress'
import { selectableOn, selectionCells, selectionInLayer, selectionLayer, type Selection } from './selection'

/** What the Selection bar's Mirror came to: the Project with the copies laid, and how many counterparts fell off. */
export interface MirroredSelection {
  project: Project
  dropped: number
}

/** Mirror (Selection bar) (ticket 0707, spec 0702): the fragment's beads copied to their counterparts on its own layer
 * as one drawing change, the fragment untouched (a counterpart landing on one of its beads keeps that bead); one the
 * layer has no position for, or in a finished row, is dropped and counted. The same Project back when nothing is copied. */
export function mirrorLayerSelection(project: Project, selection: Selection, setting: MirrorSetting): MirroredSelection {
  if (!isMirrorOn(setting)) return { project, dropped: 0 }
  const layer = selectionLayer(project, selection)
  const sheet = layerSheet(project, layer)
  const local = selectionInLayer(project, layer, selection)
  const sources: BeadChange[] = []
  for (const { row, column } of selectionCells(sheet, local, selectableOn(project, sheet))) {
    const color = colorAt(sheet.beads, row, column)
    if (color) sources.push({ row, column, color })
  }
  if (sources.length === 0) return { project, dropped: 0 }

  const mirrored = counterparts(sheet, setting, sources)
  const finished = finishedRowsOf(project)
  const images = mirrored.positions.slice(sources.length)
  const landed = images.filter((image) => !finished({ ...positionOnCanvas(project, layer, image), layer }))
  const copied = onLayer(project, layer, ({ beads }) => withColors(beads, landed))
  return { project: copied, dropped: mirrored.dropped + images.length - landed.length }
}
