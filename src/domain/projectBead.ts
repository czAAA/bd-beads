import { beadsDiffer, type Bead } from './beads'
import type { Layer } from './grid'
import { beadOfLayer, frameById, type Layered, weaveOfLayer, withLayer, wovenLayerOf } from './layerRecord'
import { touch, type Project } from './project'
import { beadCell, type BeadCell } from './weave'

// The Project's Bead (ticket 534, ADR 0072): each layer's saved copy (ADR 0079, ticket 0665), the cell it draws (ADR 0068)
// and swapping it for another. The woven layer's, the Frame's when there is one, is the one the Project is made in.

/** How the woven layer's Bead is drawn, from its own copy (ADR 0068, ticket 0724): none for a Bead nobody knows. */
export function projectCell(project: Layered): BeadCell | undefined {
  return beadCell(beadOfLayer(project, wovenLayerOf(project)).bead, (weaveOfLayer(project, wovenLayerOf(project)) ?? weaveOfLayer(project, 'canvas')).technique)
}

/** The Bead a Project is woven from (ticket 37, ADR 0079): the Frame's when there is one, else the Canvas's, its own
 * copy (ticket 534), so a catalog change or a retired Bead leaves it alone. What its sizes, counts and weight are read
 * in. Undefined for an id nobody knows; callers show a placeholder, not a raw id. */
export function resolveProjectBead(project: Layered): Bead | undefined {
  return beadOfLayer(project, wovenLayerOf(project)).bead
}

/** Swaps a layer's Bead (tickets 48, 0665, ADR 0007, 0079): the Frame's or the Canvas's, the Canvas's on a Project with
 * no Frame. Painted cells keep their hex and position, and the Palette is the Project's own, so no color comes or goes
 * (ADR 0103). The same Project for the Bead that layer already has. */
export function replaceBead(project: Project, bead: Bead, layer?: Layer): Project {
  const target = layer === 'canvas' ? 'canvas' : layer && frameById(project, layer) ? layer : wovenLayerOf(project)
  const own = beadOfLayer(project, target).bead
  if (own?.id === bead.id && !beadsDiffer(own, bead)) {
    return project
  }
  return touch(withLayer(project, target, { bead }), {})
}
