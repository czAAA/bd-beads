import type { FrameSheet } from '../domain/canvas'
import { canvasOf, frameOf, withCanvas, withFrameSheet, withLetters } from '../domain/layerRecord'
import { rowProgressOf } from '../domain/rowProgress'
import type { CanvasLayer, FrameLayer, LayerFields, Project } from '../domain/project'
import { DEFAULT_BEAD } from '../domain/beads'
import { DEFAULT_TECHNIQUE } from '../domain/weave'

/** What a test sets on a Project in one go (ticket 0664): the Canvas layer's own fields, the Bead, Bead shape and
 * Letters of every layer, the Frame layer as a sheet (none removes it) and its Row progress, and the Project's own. */
export type LayersChange = Partial<Pick<CanvasLayer, 'name' | 'technique' | 'techniqueSettings' | 'beads' | 'pieceNames' | 'orientation'>> &
  Partial<Pick<LayerFields, 'beadId' | 'bead' | 'beadShape' | 'letters'>> &
  Partial<Pick<FrameLayer, 'rowProgress'>> & { frame?: (FrameSheet & Partial<FrameLayer>) | undefined } & Partial<Omit<Project, 'layers'>>

/** The Project with its layers' fields set where given (ticket 0664): `technique`, `techniqueSettings`, `beads`,
 * `name`, `pieceNames` and `orientation` go to the Canvas, the Bead, Bead shape and Letters to every layer, `frame`
 * lays the Frame's sheet (or removes it) and `rowProgress` goes to the Frame. Not stamped. */
export function withLayers(project: Project, change: LayersChange): Project {
  const { name, technique, techniqueSettings, beadId, bead, beadShape, beads, frame, rowProgress, letters, pieceNames, orientation, ...rest } = change
  let next: Project = { ...project, ...rest }
  const canvas: Partial<CanvasLayer> = {
    ...(name !== undefined ? { name } : {}),
    ...(technique !== undefined ? { technique } : {}),
    ...('techniqueSettings' in change ? { techniqueSettings } : {}),
    ...(beads !== undefined ? { beads } : {}),
    ...('pieceNames' in change ? { pieceNames } : {}),
    ...(orientation !== undefined ? { orientation } : {}),
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

/** The Frame layer's sheet alone (ticket 0664): its place, Weave, beads, Folded beads, name, Frame shape, settings and
 * turn, without the layer's id, Bead, Letters and Row progress. What a test that compares a Frame whole expects. */
export function frameSheetOf(project: Pick<Project, 'layers'>): FrameSheet | undefined {
  const frame = frameOf(project)
  if (!frame) return undefined
  const { id: _id, beadId: _beadId, bead: _bead, beadShape: _shape, letters: _letters, pieceNames: _names, rowProgress: _progress, ...sheet } = frame
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
  return { ...own, ...canvas, ...(frameOf(project) ? { frame: frameSheetOf(project) } : {}), rowProgress: rowProgressOf(project) }
}
