import { forEachBead, type BeadMap, type FrameSheet } from './canvas'
import { withEachBead, type SheetBeads } from './folding'
import type { Layer } from './grid'
import { layerWeave, sameWeave, unwoven, weaveOf } from './layerWeave'
import { touch, type Project } from './project'
import { describeWeave, type Technique, type TechniqueSettings, type Weave } from './weave'

// Switching a layer's Weave (ADR 0038): its Technique and its settings, and the beads a switch drops.

/** A change of a layer's Weave (tickets 351, 477, 568, 0625): another Technique with any settings given for it, or the
 * same Technique with other settings. */
export type WeaveChange = { technique: Technique; techniqueSettings?: TechniqueSettings } | { techniqueSettings: TechniqueSettings }

/** The layer's Weave switched to another Technique, or to its own with other settings (ADR 0038, ticket 0625): each
 * setting given replaces the layer's, and the rest are held as `heldSettings` says (a Brick block stays, a Net size off
 * Netting goes, one the Technique describes and the layer lacks is its default). */
export function switchedWeave(current: Weave, technique: Technique, settings: TechniqueSettings = {}): Weave {
  return weaveOf({ technique, techniqueSettings: { ...current.techniqueSettings, ...settings } })
}

/** The Canvas's beads that keep a place in `weave`, and how many are left without one: a hole of Netting. */
function beadsInWeave(beads: BeadMap, weave: Weave): { kept: BeadMap; lost: number } {
  const { hasPosition } = describeWeave(weave)
  const kept: BeadMap = {}
  let lost = 0
  forEachBead(beads, (row, column, color) => {
    if (hasPosition({ row, column })) {
      kept[row] ??= {}
      kept[row]![column] = color
    } else {
      lost++
    }
  })
  return { kept, lost }
}

/** The beads a switch drops (ticket 0641): `lost` all of them, `folded` how many of those are Folded beads, out of sight. */
export interface SwitchLoss {
  lost: number
  folded: number
}

const NO_LOSS: SwitchLoss = { lost: 0, folded: 0 }

/** A Frame's beads, shown and Folded (ticket 0638), that keep their row and column in `weave`, counted from its own
 * corner, and what is dropped: a hole of Netting, the empty last column of a Right-angle weave line. */
function frameInWeave(frame: FrameSheet, weave: Weave): { kept: SheetBeads; loss: SwitchLoss } {
  const { hasPosition } = describeWeave(weave)
  const own = { row: 0, column: 0, rows: frame.rows, columns: frame.columns }
  const loss = { ...NO_LOSS }
  const kept = withEachBead(frame, (position, folded) => {
    if (hasPosition(position, own)) return position
    loss.lost++
    if (folded) loss.folded++
    return undefined
  })
  return { kept, loss }
}

/** The beads of the Canvas, or of the Frame with its Folded ones, a switch to `technique` with `settings` would drop. */
export function switchLoss(project: Project, layer: Layer, technique: Technique, settings?: TechniqueSettings): SwitchLoss {
  if (layer === 'frame' && !project.frame) {
    return NO_LOSS
  }
  const weave = switchedWeave(layerWeave(project, layer), technique, settings)
  return layer === 'frame' ? frameInWeave(project.frame!, weave).loss : { lost: beadsInWeave(project.beads, weave).lost, folded: 0 }
}

/** The layer woven anew (tickets 351, 477, 492, 568, ADR 0038): its beads, and a Frame's Folded ones (ticket 0638), keep
 * their row and column where the new Weave has a position and the rest are dropped; the other layer stays as it is. The
 * same Project comes back where the Weave lays positions out as before, or the layer is a Frame the Project lacks. */
export function withWeave(project: Project, layer: Layer, change: WeaveChange): Project {
  const current = layerWeave(project, layer)
  const weave = switchedWeave(current, 'technique' in change ? change.technique : current.technique, change.techniqueSettings)
  if ((layer === 'frame' && !project.frame) || sameWeave(current, weave)) {
    return project
  }
  if (layer === 'canvas') {
    return touch({ ...unwoven(project), ...weave }, { beads: beadsInWeave(project.beads, weave).kept })
  }
  const { folded: _folded, ...frame } = unwoven(project.frame!)
  return touch(project, { frame: { ...frame, ...weave, ...frameInWeave(project.frame!, weave).kept } })
}
