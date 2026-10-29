import type { FlatProject } from '../domain/flatWeave'
import { canvasOf } from '../domain/layerRecord'
import { encodeProject } from '../domain/projectEncoding'
import type { Project } from '../domain/project'
import { rowProgressOf } from '../domain/rowProgress'
import { frameSheetOf } from './layerFields'

// A Project as builds before ticket 0664 stored and wrote it, for tests of reading one: the Canvas layer's fields the
// Project's own and the Frame layer a sheet beside them (file versions 4 to 11). Its beads are encoded as today's are.

/** A Project as stores and files held it before its layers (ticket 0664), for a test that builds such a stored value
 * from a Project of today: the Canvas layer's fields the Project's own, its orientation as `rotation`, the Frame
 * layer's sheet beside them as `frame`. */
export function legacyRecordOf(project: Project): FlatProject {
  const { layers: _layers, ...own } = project
  const { id: _id, orientation, ...canvas } = canvasOf(project)
  const sheet = frameSheetOf(project)
  return { ...own, ...canvas, rotation: orientation, rowProgress: rowProgressOf(project), ...(sheet ? { frame: sheet } : {}) }
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
