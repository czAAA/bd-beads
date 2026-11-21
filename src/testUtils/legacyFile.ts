import type { FlatProject } from '../domain/flatWeave'
import { canvasOf, quarterTurnOf } from '../domain/layerRecord'
import { encodeProject } from '../domain/projectEncoding'
import type { FrameLayer, Project } from '../domain/project'
import { rowProgressOf, type OwnRowProgress } from '../domain/rowProgress'
import { turnedWay, type SeenWay } from '../domain/rowWays'
import { frameQuarterTurnOf } from '../domain/table'
import { frameSheetOf } from './layerFields'

// A Project as builds before ticket 0664 stored and wrote it, for tests of reading one: the Canvas layer's fields the
// Project's own and the Frame layer a sheet beside them (file versions 4 to 11). Its beads are encoded as today's are.

/** A Project as stores and files held it before its layers (ticket 0664), for a test that builds such a stored value
 * from a Project of today: the Canvas layer's fields the Project's own, its orientation as `rotation` (the quarter turns they held), the Frame
 * layer's sheet beside them as `frame`. */
export function legacyRecordOf(project: Project): FlatProject {
  const { layers: _layers, ...own } = project
  const { id: _id, orientation: _orientation, ...canvas } = canvasOf(project)
  const { angle: _angle, ...sheet } = (frameSheetOf(project) ?? {}) as Partial<FrameLayer>
  return { ...own, ...canvas, rotation: quarterTurnOf(project), rowProgress: ownProgressOf(project), ...('row' in sheet ? { frame: sheet as FlatProject['frame'] } : {}) }
}

/** The pointer of each of the Frame's own ways, as such a file named them. */
const OWN_POINTERS: Record<SeenWay, keyof OwnRowProgress> = { down: 'currentRow', right: 'currentColumn', up: 'currentRowBack', left: 'currentColumnBack' }

/** The Project's Row progress as such a file held it, in the Frame's own rows (ticket 1185): the way as seen and each
 * pointer turned back by the Frame's quarter turn on the table. */
function ownProgressOf(project: Project): OwnRowProgress {
  const turns = frameQuarterTurnOf(project) / 90
  const rowProgress = rowProgressOf(project)
  const own = turnedWay(rowProgress.way, -turns)
  const held: OwnRowProgress = { direction: own === 'down' || own === 'up' ? 'rows' : 'columns', ...(own === 'up' || own === 'left' ? { reversed: true } : {}), currentRow: 0, currentColumn: 0 }
  for (const way of ['down', 'right', 'up', 'left'] as const) {
    const count = rowProgress[way]
    if (count) held[OWN_POINTERS[turnedWay(way, -turns)]] = count as never
  }
  return held
}

/** One Project as such a file held it: the Frame's shape under its earlier name, `kind`. */
export function legacyEncoded(project: Project): Record<string, unknown> {
  const [canvasLayer, frameLayer] = encodeProject(project).layers
  const { beads: _beads, frame: sheet, techniqueSettings: _settings, ...record } = legacyRecordOf(project)
  const settings = canvasLayer!.techniqueSettings ? { techniqueSettings: canvasLayer!.techniqueSettings } : {}
  if (!sheet || !frameLayer) return { ...record, ...settings, encodedBeads: canvasLayer!.encodedBeads }
  const { beads: _frameBeads, folded: _folded, shape, techniqueSettings: _frameSettings, ...place } = sheet
  const frameSettings = frameLayer.techniqueSettings ? { techniqueSettings: frameLayer.techniqueSettings } : {}
  const folded = frameLayer.encodedFolded ? { encodedFolded: frameLayer.encodedFolded } : {}
  return { ...record, ...settings, encodedBeads: canvasLayer!.encodedBeads, frame: { ...place, ...frameSettings, ...(shape ? { kind: shape } : {}), encodedBeads: frameLayer.encodedBeads, ...folded } }
}

/** A Project file of an earlier version holding these Projects, as parsed JSON. */
export function legacyFile(projects: Project[], version = 11, kind = 'openbeads/project') {
  return { kind, version, projects: projects.map(legacyEncoded) as Record<string, any>[] } // eslint-disable-line @typescript-eslint/no-explicit-any
}
