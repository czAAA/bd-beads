import { beadsFromColors, changedPositions, colorAt, forEachBead, frameContains, hasBeads, sameFrame, type BeadMap } from './canvas'
import type { Layer } from './grid'
import { sameWeave, weaveOf } from './layerWeave'
import { beadsOfLayer, heldWeave } from './layerRecord'
import type { Grid, Project } from './project'
import { DEFAULT_TECHNIQUE, type Weave } from './weave'

// What the beads on the two layers (ADR 0066) are: the one seen at a position, whether any are painted, their colors.

/** The color of the bead you see at a Canvas position: the Frame's own where the Frame lies over it, else the Canvas's
 * (ADR 0066). A hex, or null where nothing is painted. */
export function beadColorAt(project: Pick<Project, 'beads' | 'frame'>, row: number, column: number, layer?: Layer): string | null {
  const frame = project.frame
  return frame && (layer ? layer === 'frame' : frameContains(frame, { row, column }))
    ? colorAt(beadsOfLayer(project, 'frame')!, row - frame.row, column - frame.column)
    : colorAt(beadsOfLayer(project, 'canvas'), row, column)
}

/** Whether the Project has a bead on either layer. */
export function hasProjectBeads(project: Pick<Project, 'beads' | 'frame'>): boolean {
  const frame = beadsOfLayer(project, 'frame')
  return hasBeads(beadsOfLayer(project, 'canvas')) || (frame !== undefined && hasBeads(frame))
}

/** Every color on either layer, each once, in the order the layers hold them. */
export function projectColors(project: Pick<Project, 'beads' | 'frame'>): string[] {
  const colors = new Set<string>()
  for (const beads of [beadsOfLayer(project, 'canvas'), beadsOfLayer(project, 'frame') ?? {}]) {
    forEachBead(beads, (_row, _column, color) => colors.add(color))
  }
  return [...colors]
}

/** Whether two states of a Project hold the same beads on both layers (ADR 0066). A layer neither touched costs
 * nothing: its maps are the same object. */
export function sameBeads(a: Pick<Project, 'beads' | 'frame'>, b: Pick<Project, 'beads' | 'frame'>): boolean {
  const same = (x: BeadMap | undefined, y: BeadMap | undefined) => x === y || changedPositions(x ?? {}, y ?? {}).length === 0
  return same(beadsOfLayer(a, 'canvas'), beadsOfLayer(b, 'canvas')) && same(beadsOfLayer(a, 'frame'), beadsOfLayer(b, 'frame'))
}

/** Whether two states of a Project hold the same Frame and beads: the Frame's place, size, Weave, name, shape, settings
 * and turn, its shown and Folded beads, and the Canvas's. How a held Frame change (ticket 0640) knows it came back to
 * where it began, and so is no Undo step. */
export function sameLayers(a: Pick<Project, 'beads' | 'frame'>, b: Pick<Project, 'beads' | 'frame'>): boolean {
  const [x, y] = [a.frame, b.frame]
  if (!x || !y) return x === y && sameBeads(a, b)
  const names = new Set([...Object.keys(x.settings ?? {}), ...Object.keys(y.settings ?? {})]) as Set<keyof NonNullable<typeof x.settings>>
  return (
    sameFrame(x, y) &&
    sameWeave(heldWeave(a, 'frame')!, heldWeave(b, 'frame')!) &&
    x.name === y.name &&
    x.shape === y.shape &&
    x.quarterTurns === y.quarterTurns &&
    [...names].every((name) => x.settings?.[name] === y.settings?.[name]) &&
    sameBeads(a, b) &&
    (x.folded === y.folded || changedPositions(x.folded ?? {}, y.folded ?? {}).length === 0)
  )
}

/** A dense grid of cells as a Frame the size of the grid holding them: what the Convert image preview, the Homepage's
 * pictures and a test's hand-made block of beads are drawn from. */
export function framedGrid(grid: Grid, weave: Weave = { technique: DEFAULT_TECHNIQUE }): Pick<Project, 'beads' | 'frame'> {
  return {
    beads: {},
    frame: { row: 0, column: 0, columns: grid[0]?.length ?? 0, rows: grid.length, beads: beadsFromColors(grid.map((row) => row.map((cell) => cell.color))), ...weaveOf(weave) },
  }
}
