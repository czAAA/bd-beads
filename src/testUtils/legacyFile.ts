import { encodeProject } from '../domain/projectEncoding'
import type { Project } from '../domain/project'
import { flatOf } from './flatFields'

// A Project file as builds before ticket 0664 wrote it, for tests of reading one: the Canvas's fields the Project's own
// and the Frame a sheet beside them (file versions 4 to 11). Its beads are encoded as today's file encodes them.

/** One Project as such a file held it: the Frame's shape under its earlier name, `kind`. */
export function legacyEncoded(project: Project): Record<string, unknown> {
  const [canvas, frame] = encodeProject(project).layers
  const { beads: _beads, frame: sheet, techniqueSettings: _settings, ...flat } = flatOf(project)
  const settings = canvas!.techniqueSettings ? { techniqueSettings: canvas!.techniqueSettings } : {}
  if (!sheet || !frame) return { ...flat, ...settings, encodedBeads: canvas!.encodedBeads }
  const { beads: _frameBeads, folded: _folded, shape, techniqueSettings: _frameSettings, ...place } = sheet
  const frameSettings = frame.techniqueSettings ? { techniqueSettings: frame.techniqueSettings } : {}
  const folded = frame.encodedFolded ? { encodedFolded: frame.encodedFolded } : {}
  return { ...flat, ...settings, encodedBeads: canvas!.encodedBeads, frame: { ...place, ...frameSettings, ...(shape ? { kind: shape } : {}), encodedBeads: frame.encodedBeads, ...folded } }
}

/** A Project file of an earlier version holding these Projects, as parsed JSON. */
export function legacyFile(projects: Project[], version = 11, kind = 'openbeads/project') {
  return { kind, version, projects: projects.map(legacyEncoded) as Record<string, any>[] } // eslint-disable-line @typescript-eslint/no-explicit-any
}
