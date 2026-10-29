import type { Layer } from './grid'
import { withLayer } from './layerRecord'
import { layerWeave, sameWeave, weaveOf } from './layerWeave'
import { touch, type Project } from './project'
import type { Technique, TechniqueSettings, Weave } from './weave'

// Switching a layer's Weave (ADR 0038): its Technique and its settings. Every Technique has a position at each row and
// column, so a switch keeps every bead where it is.

/** A change of a layer's Weave (tickets 351, 477, 0625): another Technique with any settings given for it, or the same
 * Technique with other settings. */
export type WeaveChange = { technique: Technique; techniqueSettings?: TechniqueSettings } | { techniqueSettings: TechniqueSettings }

/** The layer's Weave switched to another Technique, or to its own with other settings (ADR 0038, ticket 0625): each
 * setting given replaces the layer's, and the rest are held as `heldSettings` says (a Brick block stays, one the
 * Technique describes and the layer lacks is its default). */
export function switchedWeave(current: Weave, technique: Technique, settings: TechniqueSettings = {}): Weave {
  return weaveOf({ technique, techniqueSettings: { ...current.techniqueSettings, ...settings } })
}

/** The layer woven anew (tickets 351, 477, 492, ADR 0038): its beads, and a Frame's Folded ones (ticket 0638), keep
 * their row and column; the other layer stays as it is. The same Project comes back where the Weave lays positions out
 * as before, or the layer is a Frame the Project lacks. */
export function withWeave(project: Project, layer: Layer, change: WeaveChange): Project {
  const current = layerWeave(project, layer)
  const weave = switchedWeave(current, 'technique' in change ? change.technique : current.technique, change.techniqueSettings)
  if ((layer === 'frame' && !project.frame) || sameWeave(current, weave)) {
    return project
  }
  return touch(withLayer(project, layer, { weave }), {})
}
