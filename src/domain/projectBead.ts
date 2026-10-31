import { beadsDiffer, colorCatalogOf, type Bead } from './beads'
import type { ColorCatalog } from './colorCatalog'
import type { Layer } from './grid'
import { beadIdOfLayer, beadOfLayer, frameOf, type Layered, weaveOfLayer, withLayer } from './layerRecord'
import { codesForBead, defaultPalette, paletteForBead } from './palette'
import { lettersOfPalette } from './paletteEdits'
import { touch, type Project } from './project'
import { beadCell, type BeadCell } from './weave'

// The Project's Bead (ticket 534, ADR 0072): each layer's saved copy (ADR 0079, ticket 0665), the cell it draws (ADR 0068)
// and swapping it for another. The woven layer's, the Frame's when there is one, is the one the Project is made in.

/** How the woven layer's Bead is drawn, from its own copy (ADR 0068, ticket 0724): none for a Bead nobody knows. */
export function projectCell(project: Layered): BeadCell | undefined {
  return beadCell(beadOfLayer(project, 'frame').bead, (weaveOfLayer(project, 'frame') ?? weaveOfLayer(project, 'canvas')).technique)
}

/** The Bead a Project is woven from (ticket 37, ADR 0079): the Frame's when there is one, else the Canvas's, its own
 * copy (ticket 534), so a catalog change or a retired Bead leaves it alone. What its sizes, counts and weight are read
 * in. Undefined for an id nobody knows; callers show a placeholder, not a raw id. */
export function resolveProjectBead(project: Layered): Bead | undefined {
  return beadOfLayer(project, 'frame').bead
}

/** Swaps a layer's Bead (tickets 48, 0665, ADR 0007, 0079): the Frame's or the Canvas's, the Canvas's on a Project with
 * no Frame. Painted cells keep their hex and position; the Palette follows when the woven layer's Bead changes, in the
 * same change (see `withWovenPalette`). The same Project for the Bead that layer already has. */
export function replaceBead(project: Project, bead: Bead, catalog?: ColorCatalog, layer: Layer = 'frame'): Project {
  const target = frameOf(project) ? layer : 'canvas'
  const own = beadOfLayer(project, target).bead
  if (own?.id === bead.id && !beadsDiffer(own, bead)) {
    return project
  }
  const replaced = withLayer(project, target, { bead })
  return touch(withWovenPalette(project, replaced, catalog), {})
}

/** `after` with its Palette moved to its woven layer's Bead where that differs from `before`'s (tickets 0528, 0665): the
 * built-in colors follow its set, a swatch keeps its code if `catalog` (the new Bead's) lists it in its size (ticket
 * 0538), or with none while Color catalog and size stay. The same `after` when the woven Bead is as it was. */
export function withWovenPalette(before: Project, after: Project, catalog?: ColorCatalog): Project {
  const [from, to] = [beadOfLayer(before, 'frame').bead, beadOfLayer(after, 'frame').bead]
  const [fromId, toId] = [beadIdOfLayer(before, 'frame'), beadIdOfLayer(after, 'frame')]
  if (fromId === toId && (!from || !to || !beadsDiffer(from, to))) {
    return after
  }
  const palette = paletteForBead(after.palette, after.removedDefaults ?? [], defaultPalette(fromId), defaultPalette(toId))
  const kept = !catalog && colorCatalogOf(fromId) === colorCatalogOf(toId) && from?.size === to?.size
  const codes = kept ? (after.paletteCodes ?? {}) : codesForBead(after.paletteCodes ?? {}, catalog, to?.size)
  const { paletteCodes: _codes, ...rest } = after
  const paletteLetters = lettersOfPalette(palette, toId, after.paletteLetters)
  return { ...rest, palette, paletteLetters, ...(Object.keys(codes).length > 0 ? { paletteCodes: codes } : {}) }
}
