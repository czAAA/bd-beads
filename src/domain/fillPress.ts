import { colorAt, forEachChangedPosition, type Rect } from './canvas'
import { keepAllowedEdits } from './allowedEdits'
import { fillArea, isFillRefusal, type FillRefusal } from './fill'
import type { GridPosition, Layer, PreviewCell } from './grid'
import { beadsOfLayer } from './layerRecord'
import { onLayer, positionInLayer, positionOnCanvas } from './layers'
import type { MirrorSetting } from './mirror'
import type { Project } from './project'

/** A Fill tool press (ticket 25): the Canvas position pressed, the layer it is on and the color it pours. */
export interface FillPress {
  row: number
  column: number
  layer: Layer
  color: string | null
}

/** What bounds a Fill press besides its layer's own edge (Fill reach, ticket 0715). */
export interface FillPressReach {
  /** The Mirror (ticket 1025): a Fill is not mirrored, but on the Canvas its Area's edge is the flood's border. */
  mirror: MirrorSetting
  /** The Canvas positions on screen at the press, none until the view is measured. */
  onScreen: Rect | undefined
}

/** The Project a Fill press makes (ADR 0026, tickets 0715, 1025), or why Fill reach refused it: the one command both
 * the press and its hover preview run (ticket 1153). Edit's rules are applied after it, as for every drawing. */
export function fillPressed(project: Project, { row, column, layer, color }: FillPress, { mirror, onScreen }: FillPressReach): Project | FillRefusal {
  const place = mirror.place
  // The Mirror's Canvas Area is a border on the Canvas: the frame's own edge already bounds a Fill there.
  const border = layer === 'canvas' && place?.layer === 'canvas' ? place.area : undefined
  let refused: FillRefusal | undefined
  const made = onLayer(project, layer, (sheet, local) => {
    const at = local({ row, column })
    const filled = fillArea(sheet, at.row, at.column, color, { onScreen, border })
    if (!isFillRefusal(filled)) return filled
    refused = filled
    return sheet.beads
  })
  return refused ?? made
}

/** The beads a Fill press would change (ticket 1153), as Canvas positions, those on the Frame named so: exactly what
 * the press lands once Edit's rules keep rows marked done, the margin and the Frame's covered beads. None when Fill
 * reach would refuse it or it changes nothing. `region` is the Project it makes, for `inFilledRegion`. */
export function fillPreview(project: Project, press: FillPress, reach: FillPressReach): { cells: PreviewCell[]; region: Project } {
  const made = fillPressed(project, press, reach)
  if (isFillRefusal(made)) return { cells: [], region: project }
  const kept = keepAllowedEdits(project, made)
  const before = beadsOfLayer(project, press.layer) ?? {}
  const after = beadsOfLayer(kept, press.layer) ?? {}
  const cells: PreviewCell[] = []
  forEachChangedPosition(before, after, (row, column) => {
    const onCanvas = positionOnCanvas(project, press.layer, { row, column })
    cells.push(press.layer === 'frame' ? { ...onCanvas, layer: 'frame' } : onCanvas)
  })
  return { cells, region: kept }
}

/** Whether a Fill pressed at `at` on `layer` would flood the very region a preview made `region` from (ticket 1153):
 * the press changed its bead, so any press inside it floods the same beads, and the preview needs no new flood. */
export function inFilledRegion(project: Project, region: Project, layer: Layer, at: GridPosition): boolean {
  if (region === project) return false
  const local = positionInLayer(project, layer, at)
  const before = beadsOfLayer(project, layer) ?? {}
  const after = beadsOfLayer(region, layer) ?? {}
  return colorAt(before, local.row, local.column) !== colorAt(after, local.row, local.column)
}
