import { forEachBead, withColors, type BeadChange, type BeadMap } from './canvas'
import type { Layered } from './layerRecord'
import { touch, type Project } from './project'

// The beads painted in some colors (ticket 1124): a color leaves the Palette with every bead painted in it, so no bead
// is left with a color that has no Swatch letter (the exports printed "?" for one).

/** How many beads on the layers are in one of `hexes`: all that removing them takes, a Frame's Folded beads too. */
export function beadsInColors(project: Layered, hexes: ReadonlySet<string>): number {
  return project.layers.reduce((count, layer) => {
    const folded = 'folded' in layer && layer.folded ? beadsIn(layer.folded, hexes).length : 0
    return count + beadsIn(layer.beads, hexes).length + folded
  }, 0)
}

/** The Project with every bead in one of `hexes` taken off, on every layer and from a Frame's Folded beads too, so none
 * comes back in that color when the Frame grows. The same Project when none is painted in them. */
export function withoutBeadsIn(project: Project, hexes: ReadonlySet<string>): Project {
  return withLayerBeads(project, (beads) => withColors(beads, beadsIn(beads, hexes).map((bead) => ({ ...bead, color: null }))))
}

/** The beads in one of `hexes` that `before` held put back on the same layer of `project`, where that place is still
 * empty: a color removal's Undo from its toast (ticket 1124), whatever was drawn since. A layer gone since gets none. */
export function withBeadsBackIn(project: Project, before: Layered, hexes: ReadonlySet<string>): Project {
  return withLayerBeads(project, (beads, id, folded) => {
    const was = before.layers.find((layer) => layer.id === id)
    const held = was && (folded ? ('folded' in was ? was.folded : undefined) : was.beads)
    return held ? withColors(beads, beadsIn(held, hexes).filter(({ row, column }) => beads[row]?.[column] === undefined)) : beads
  })
}

/** Every bead of `beads` in one of `hexes`, as a change that paints it so. */
function beadsIn(beads: BeadMap, hexes: ReadonlySet<string>): BeadChange[] {
  const found: BeadChange[] = []
  forEachBead(beads, (row, column, color) => hexes.has(color) && found.push({ row, column, color }))
  return found
}

/** The Project with `change` applied to each layer's beads and each Frame's Folded beads (`folded` true), by layer id;
 * the same Project when nothing changes. Folded beads left empty are dropped, as a Frame without any holds none. */
function withLayerBeads(project: Project, change: (beads: BeadMap, layerId: string, folded: boolean) => BeadMap): Project {
  let changed = false
  const layers = project.layers.map((layer, index) => {
    const beads = change(layer.beads, layer.id, false)
    const held = 'folded' in layer ? layer.folded : undefined
    // Every layer after the Canvas is a Frame, which may hold Folded beads (ADR 0079).
    const folded = index > 0 ? change(held ?? {}, layer.id, true) : undefined
    if (beads === layer.beads && (folded === held || (!held && folded && Object.keys(folded).length === 0))) return layer
    changed = true
    const { folded: _folded, ...rest } = layer as typeof layer & { folded?: BeadMap }
    return { ...rest, beads, ...(folded && Object.keys(folded).length > 0 ? { folded } : {}) }
  }) as Project['layers']
  return changed ? touch(project, { layers }) : project
}
