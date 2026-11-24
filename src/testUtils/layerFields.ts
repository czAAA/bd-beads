import { frameIdIn } from './frameId'
import type { FrameSheet } from '../domain/canvas'
import { canvasOf, frameOf, withCanvas, withFrameFields, withLetters } from '../domain/layerRecord'
import { withFrameSheet } from '../domain/frameSheet'
import { nearestQuarterTurn, normalizedOrientation } from '../domain/canvasOrientation'
import { turnedWithFrame } from '../domain/rowWays'
import { rowProgressOf, seenProgressOf, type OwnRowProgress } from '../domain/rowProgress'
import { frameQuarterTurnOf } from '../domain/table'
import type { CanvasLayer, FrameLayer, LayerFields, Project, RowProgress } from '../domain/project'
import { DEFAULT_BEAD } from '../domain/beads'
import { DEFAULT_TECHNIQUE } from '../domain/weave'

/** What a test sets on a Project in one go (ticket 0664): the Canvas layer's own fields, the Bead and Letters of
 * every layer, the Frame layer as a sheet (none removes it) and its Row progress, and the Project's own. */
export type LayersChange = Partial<Pick<CanvasLayer, 'name' | 'technique' | 'techniqueSettings' | 'beads' | 'pieceNames' | 'orientation'>> &
  Partial<Pick<LayerFields, 'beadId' | 'bead' | 'letters'>> &
  Partial<Pick<FrameLayer, 'rowProgress'>> & { frame?: (FrameSheet & Partial<FrameLayer>) | undefined; ownProgress?: Partial<OwnRowProgress> } & Partial<Omit<Project, 'layers'>>

/** The Project with its layers' fields set where given (ticket 0664): the Canvas's own fields (`orientation` carrying
 * the Frame), the Bead and Letters to every layer, `frame` laid as the Frame's sheet (none removes it), `rowProgress` or
 * `ownProgress` (in its own rows, ownProgressOf) to the Frame. Not stamped. */
export function withLayers(project: Project, change: LayersChange): Project {
  const { name, technique, techniqueSettings, beadId, bead, beads, frame, rowProgress, ownProgress, letters, pieceNames, orientation, ...rest } = change
  let next: Project = { ...project, ...rest }
  const canvas: Partial<CanvasLayer> = {
    ...(name !== undefined ? { name } : {}),
    ...(technique !== undefined ? { technique } : {}),
    ...('techniqueSettings' in change ? { techniqueSettings } : {}),
    ...(beads !== undefined ? { beads } : {}),
    ...('pieceNames' in change ? { pieceNames } : {}),
  }
  next = withCanvas(next, canvas)
  if ('frame' in change) {
    next = withFrameSheet(next, frame, { frame: frameIdIn(next) })
  }
  // The Canvas's turn carries the Frame laid, its rows and all (`withPictureTurned`).
  if (orientation !== undefined) next = withPictureTurned(next, orientation)
  if (rowProgress && frameOf(next)) {
    next = withFrameSheet(next, { ...frameOf(next)!, rowProgress }, { frame: frameIdIn(next) })
  }
  if (ownProgress && frameOf(next)) {
    next = withFrameSheet(next, { ...frameOf(next)!, rowProgress: ownProgressOf(next, ownProgress) }, { frame: frameIdIn(next) })
  }
  const shared: Partial<LayerFields> = {
    ...(beadId !== undefined ? { beadId } : {}),
    ...('bead' in change ? { bead } : {}),
  }
  if (Object.keys(shared).length > 0) {
    next = { ...next, layers: next.layers.map((layer) => ({ ...layer, ...shared })) as Project['layers'] }
  }
  return letters !== undefined ? withLetters(withLetters(next, 'canvas', letters), frameIdIn(next), letters) : next
}

/** The whole picture turned to `orientation`: the Canvas, and the Frame laid on it carried with it, its angle turned as
 * far and its Row progress kept on its own rows (a Custom frame's runs one way and stays). Rotate canvas no longer
 * carries the Frame (ticket 1188); a test that wants a turned picture, as an older file opens, builds it so. */
export function withPictureTurned(project: Project, orientation: number): Project {
  const [from, to] = [canvasOf(project).orientation, normalizedOrientation(orientation)]
  if (from === to) return project
  const turned = withCanvas(project, { orientation: to })
  const frame = project.layers[1]
  if (!frame) return turned
  const angle = normalizedOrientation(frame.angle + to - from)
  const turns = (nearestQuarterTurn(angle) - nearestQuarterTurn(frame.angle)) / 90
  return withFrameFields(turned, { angle, ...(frame.shape ? {} : { rowProgress: turnedWithFrame(frame.rowProgress, turns) }) }, frameIdIn(turned))
}

/** Row progress given in the Frame's own rows (along them, top to bottom, unless given), as the Project's Frame lies:
 * kept as the way it shows (ticket 1185), as an older file's is read. For a test whose subject is the Frame's own rows
 * and passes rather than the way as seen: `withLayers(project, { ownProgress: { currentRow: 2 } })`. */
export function ownProgressOf(project: Pick<Project, 'layers'>, own: Partial<OwnRowProgress>): RowProgress {
  const turns = frameOf(project)?.shape ? 0 : frameQuarterTurnOf(project, frameIdIn(project)) / 90
  return seenProgressOf({ direction: 'rows', currentRow: 0, ...own }, turns)
}

/** Row progress's pointers alone, by the way as seen each counts, without the way the rows run: `{}` at the first
 * passes. */
export function pointersOf({ way: _way, ...pointers }: RowProgress): Omit<RowProgress, 'way'> {
  return pointers
}

/** The Frame layer's sheet alone (ticket 0664): its place, Weave, beads, Folded beads, name, Frame shape, settings and
 * turn, without the layer's id, Bead, Letters and Row progress. What a test that compares a Frame whole expects. */
export function frameSheetOf(project: Pick<Project, 'layers'>): FrameSheet | undefined {
  const frame = frameOf(project)
  if (!frame) return undefined
  const { id: _id, beadId: _beadId, bead: _bead, letters: _letters, pieceNames: _names, rowProgress: _progress, angle: _angle, ...sheet } = frame
  return sheet
}

/** A Project of a bare Canvas (ticket 0664), for a test that hands a reader a bare shape: an upright Canvas of
 * nothing, with no Bead copy, its layers set by `withLayers`. */
export function bareProject(change: LayersChange): Project {
  const canvas: CanvasLayer = { id: 'canvas', name: 'Test', technique: change.technique ?? DEFAULT_TECHNIQUE, beadId: DEFAULT_BEAD.id, beads: {}, orientation: 0 }
  return withLayers({ id: 'test', layers: [canvas], palette: [], createdAt: 0, updatedAt: 0 }, change)
}

/** A Project's layers read back as one `LayersChange` (ticket 0664), for a test that matches fields by name: the
 * Project's own fields, the Canvas layer's (without its id), the Frame layer's sheet as `frame` and its Row progress
 * (the first row without a Frame). */
export function layersView(project: Project): LayersChange {
  const { layers: _layers, ...own } = project
  const { id: _id, ...canvas } = canvasOf(project)
  return { ...own, ...canvas, ...(frameOf(project) ? { frame: frameSheetOf(project) } : {}), rowProgress: rowProgressOf(project, frameIdIn(project)) }
}
