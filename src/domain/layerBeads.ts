import { beadsFromColors, changedPositions, colorAt, forEachBead, frameContains, hasBeads, type BeadMap } from './canvas'
import type { Layer } from './grid'
import { weaveOf } from './layerWeave'
import type { Grid, Project } from './project'
import { DEFAULT_TECHNIQUE, type Weave } from './weave'

// What the beads on the two layers (ADR 0066) are: the one seen at a position, whether any are painted, their colors.

/** The color of the bead you see at a Canvas position: the Frame's own where the Frame lies over it, else the Canvas's
 * (ADR 0066). A hex, or null where nothing is painted. */
export function beadColorAt(project: Pick<Project, 'beads' | 'frame'>, row: number, column: number, layer?: Layer): string | null {
  const frame = project.frame
  return frame && (layer ? layer === 'frame' : frameContains(frame, { row, column })) ? colorAt(frame.beads, row - frame.row, column - frame.column) : colorAt(project.beads, row, column)
}

/** Whether the Project has a bead on either layer. */
export function hasProjectBeads(project: Pick<Project, 'beads' | 'frame'>): boolean {
  return hasBeads(project.beads) || (project.frame !== undefined && hasBeads(project.frame.beads))
}

/** Every color on either layer, each once, in the order the layers hold them. */
export function projectColors(project: Pick<Project, 'beads' | 'frame'>): string[] {
  const colors = new Set<string>()
  for (const beads of [project.beads, project.frame?.beads ?? {}]) {
    forEachBead(beads, (_row, _column, color) => colors.add(color))
  }
  return [...colors]
}

/** Whether two states of a Project hold the same beads on both layers (ADR 0066). A layer neither touched costs
 * nothing: its maps are the same object. */
export function sameBeads(a: Pick<Project, 'beads' | 'frame'>, b: Pick<Project, 'beads' | 'frame'>): boolean {
  const same = (x: BeadMap | undefined, y: BeadMap | undefined) => x === y || changedPositions(x ?? {}, y ?? {}).length === 0
  return same(a.beads, b.beads) && same(a.frame?.beads, b.frame?.beads)
}

/** A dense grid of cells as a Frame the size of the grid holding them: what the Convert image preview, the Homepage's
 * pictures and a test's hand-made block of beads are drawn from. */
export function framedGrid(grid: Grid, weave: Weave = { technique: DEFAULT_TECHNIQUE }): Pick<Project, 'beads' | 'frame'> {
  return {
    beads: {},
    frame: { row: 0, column: 0, columns: grid[0]?.length ?? 0, rows: grid.length, beads: beadsFromColors(grid.map((row) => row.map((cell) => cell.color))), ...weaveOf(weave) },
  }
}
