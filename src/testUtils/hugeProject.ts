import { BEAD_CATALOG } from '../domain/beads'
import { createProject } from '../domain/createProject'
import type { Project } from '../domain/project'
import { encodeProject, type EncodedProject } from '../domain/projectEncoding'
import { SIZE_GATE_BEADS } from '../domain/openingLimits'
import { withLayers } from './layerFields'

const STORAGE_KEY = 'openbeads:patterns'

/** A Project over the size gate as the library stores it (ticket 0716), built straight in its stored form so no test
 * holds millions of beads: a Canvas of solid rows `columns` wide, `beads` of them in all (just over the gate by default),
 * and no Frame. Synthetic, never the maintainer's library. */
export function storedHugeProject({ id = 'huge', name = 'Huge', beads = SIZE_GATE_BEADS + 1000, columns = 1000, savedAt = 1000 }: { id?: string; name?: string; beads?: number; columns?: number; savedAt?: number } = {}): EncodedProject {
  const base = withLayers(createProject({ technique: 'loom', beadId: BEAD_CATALOG[0]!.id, size: { width: 15, height: 15, unit: 'mm' } }), { id, name, frame: undefined, createdAt: savedAt - 500, updatedAt: savedAt, savedAt })
  const encoded = encodeProject(base)
  const rows: Record<string, string> = {}
  for (let row = 0, left = beads; left > 0; row += 1, left -= columns) rows[String(row)] = `0:1x${Math.min(columns, left)}`
  return { ...encoded, layers: [{ ...encoded.layers[0]!, encodedBeads: { colors: ['#1a1a1a'], rows } }, ...encoded.layers.slice(1)] }
}

/** Stores a library of ordinary Projects and stored huge ones, as a reload would find it. */
export function storeLibrary(projects: Project[], huge: EncodedProject[] = []): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 6, patterns: [...projects.map(encodeProject), ...huge] }))
}
