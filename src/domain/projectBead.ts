import type { Bead } from './beads'
import type { ColorCatalog } from './colorCatalog'
import { beadIdOfLayer, beadOfLayer, withLayer } from './layerRecord'
import { codesForBead, defaultPalette, paletteForBead } from './palette'
import { lettersOfPalette } from './paletteEdits'
import { touch, type Project } from './project'
import { beadCell, type BeadCell, type BeadShape } from './weave'

// The Project's Bead (ticket 534, ADR 0072): its saved copy, its Bead shape (ADR 0068) and swapping it for another.

/** What decides a Project's cell: its Bead and Bead shape (both optional, so a bare layout reads as Symmetric). */
export type ShapedBead = Partial<Pick<Project, 'bead' | 'beadShape'>>

/** How the Project's Bead is drawn, from its own copy: none in Symmetric, or for a Bead nobody knows. */
export function projectCell(project: ShapedBead): BeadCell | undefined {
  const { bead, beadShape } = beadOfLayer(project, 'canvas')
  return beadCell(bead, beadShape)
}

/** The Project with another Bead shape (ADR 0068), for both layers until ticket 0665: Symmetric is the default and is
 * left unsaved. */
export function withBeadShape(project: Project, shape: BeadShape): Project {
  return withLayer(project, 'canvas', { beadShape: shape })
}

/** The Bead a Project was woven from (ticket 37): its own copy (ticket 534), so a catalog change or a retired Bead
 * leaves it alone. Undefined for an id nobody knows; callers show a placeholder, not a raw id. */
export function resolveProjectBead(project: Pick<Project, 'bead'>): Bead | undefined {
  return beadOfLayer(project, 'canvas').bead
}

/** Swaps the Project's Bead (ticket 48, ADR 0007); only the Estimated size depends on it. The Palette follows in the
 * same change (ticket 0528) and painted cells keep their hex. A swatch keeps its catalog code only if `catalog`, the
 * new Bead's, lists it in the new size (ticket 0538). */
export function replaceBead(project: Project, bead: Bead, catalog?: ColorCatalog): Project {
  const palette = paletteForBead(project.palette, project.removedDefaults ?? [], defaultPalette(beadIdOfLayer(project, 'canvas')), defaultPalette(bead.id))
  const codes = codesForBead(project.paletteCodes ?? {}, catalog, bead.size)
  const { paletteCodes: _codes, ...rest } = project
  const paletteLetters = lettersOfPalette(palette, bead.id, project.paletteLetters)
  return touch(withLayer(rest, 'canvas', { bead }), { palette, paletteLetters, ...(Object.keys(codes).length > 0 ? { paletteCodes: codes } : {}) })
}
