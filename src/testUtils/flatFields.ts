import type { FrameSheet } from '../domain/canvas'
import type { FlatProject } from '../domain/flatWeave'
import { canvasOf, frameOf, withCanvas, withFrameSheet, withLetters } from '../domain/layerRecord'
import { rowProgressOf } from '../domain/rowProgress'
import type { CanvasLayer, FrameLayer, LayerFields, Project } from '../domain/project'
import { DEFAULT_BEAD } from '../domain/beads'
import { DEFAULT_TECHNIQUE } from '../domain/weave'

/** What a test sets on a Project in the words it had before its layers (ticket 0664): the Canvas's own fields, the
 * shared Bead, Bead shape and Letters, the Frame as a sheet (none removes it), its Row progress, and the rest as they are. */
// `rotation` is the Canvas's orientation in degrees, any angle since ticket 0672.
export type FlatChange = Partial<Omit<FlatProject, 'frame' | 'rotation'>> & { frame?: (FrameSheet & Partial<FrameLayer>) | undefined; rotation?: number }

/** The Project with fields set as a test wrote them before the Project held its layers (ticket 0664): `technique`,
 * `beads`, `name`, `pieceNames` and `rotation` go to the Canvas, the Bead, Bead shape and Letters to every layer,
 * `frame` lays the Frame's sheet (or removes it) and `rowProgress` goes to the Frame. Not stamped. */
export function withFields(project: Project, change: FlatChange): Project {
  const { name, technique, techniqueSettings, beadId, bead, beadShape, beads, frame, rowProgress, letters, pieceNames, rotation, ...rest } = change
  let next: Project = { ...project, ...rest }
  const canvas: Partial<CanvasLayer> = {
    ...(name !== undefined ? { name } : {}),
    ...(technique !== undefined ? { technique } : {}),
    ...('techniqueSettings' in change ? { techniqueSettings } : {}),
    ...(beads !== undefined ? { beads } : {}),
    ...('pieceNames' in change ? { pieceNames } : {}),
    ...(rotation !== undefined ? { orientation: rotation } : {}),
  }
  next = withCanvas(next, canvas)
  if ('frame' in change) {
    next = withFrameSheet(next, frame)
  }
  if (rowProgress && frameOf(next)) {
    next = withFrameSheet(next, { ...frameOf(next)!, rowProgress })
  }
  const shared: Partial<LayerFields> = {
    ...(beadId !== undefined ? { beadId } : {}),
    ...('bead' in change ? { bead } : {}),
    ...('beadShape' in change ? { beadShape } : {}),
  }
  if (Object.keys(shared).length > 0) {
    next = { ...next, layers: next.layers.map((layer) => ({ ...layer, ...shared })) as Project['layers'] }
  }
  return letters !== undefined ? withLetters(next, letters) : next
}

/** The Frame's sheet alone (ticket 0664): its place, Weave, beads, Folded beads, name, Frame shape, settings and turn,
 * without the layer's id, Bead, Letters and Row progress. What a test that compares a Frame whole expects. */
export function sheetOf(project: Pick<Project, 'layers'>): FrameSheet | undefined {
  const frame = frameOf(project)
  if (!frame) return undefined
  const { id: _id, beadId: _beadId, bead: _bead, beadShape: _shape, letters: _letters, pieceNames: _names, rowProgress: _progress, ...sheet } = frame
  return sheet
}

/** A Project made from fields as a test wrote them before the Project held its layers (ticket 0664), for a test that
 * hands a reader a bare shape: an upright Canvas of nothing, with no Bead copy, set by `withFields`. */
export function flatProject(change: FlatChange): Project {
  const canvas: CanvasLayer = { id: 'canvas', name: 'Test', technique: change.technique ?? DEFAULT_TECHNIQUE, beadId: DEFAULT_BEAD.id, beads: {}, orientation: 0 }
  return withFields({ id: 'test', layers: [canvas], palette: [], createdAt: 0, updatedAt: 0 }, change)
}

/** A Project as the flat record it was before it held its layers (ticket 0664), for a test that matches fields by
 * those names: the Canvas's own fields, its orientation as `rotation`, the Frame's sheet as `frame` and its Row
 * progress (the first row without a Frame). */
export function flatView(project: Project): FlatChange {
  const { layers: _layers, ...rest } = project
  const { id: _id, orientation, ...canvas } = canvasOf(project)
  return { ...rest, ...canvas, rotation: orientation, ...(frameOf(project) ? { frame: sheetOf(project) } : {}), rowProgress: rowProgressOf(project) }
}

/** A Project as stores and files held it before its layers (ticket 0664), for a test that builds such a stored value
 * from a Project of today: the Canvas's fields the Project's own, the Frame's sheet beside them. */
export function flatOf(project: Project): FlatProject {
  const { frame, ...flat } = flatView(project)
  return { ...(flat as Omit<FlatProject, 'frame'>), ...(frame ? { frame } : {}) }
}
