import { anyChangedPosition, beadsFromColors, colorAt, frameContains, hasBeads, sameFrame, type BeadMap } from './canvas'
import type { Layer } from './grid'
import { sameWeave, weaveOf } from './layerWeave'
import { beadsOfLayer, frameOf, heldWeave, type Layered } from './layerRecord'
import { DEFAULT_BEAD } from './beads'
import type { Grid, LayerFields } from './project'
import { DEFAULT_TECHNIQUE, type Weave } from './weave'

// What the beads on the two layers (ADR 0066) are: the one seen at a position, whether any are painted, their colors.

/** The color of the bead you see at a Canvas position: the Frame's own where the Frame lies over it, else the Canvas's
 * (ADR 0066). A hex, or null where nothing is painted. */
export function beadColorAt(project: Layered, row: number, column: number, layer?: Layer): string | null {
  const frame = frameOf(project)
  return frame && (layer ? layer === 'frame' : frameContains(frame, { row, column }))
    ? colorAt(beadsOfLayer(project, 'frame')!, row - frame.row, column - frame.column)
    : colorAt(beadsOfLayer(project, 'canvas'), row, column)
}

/** Whether the Project has a bead on either layer. */
export function hasProjectBeads(project: Layered): boolean {
  const frame = beadsOfLayer(project, 'frame')
  return hasBeads(beadsOfLayer(project, 'canvas')) || (frame !== undefined && hasBeads(frame))
}

/** The colors of each row of beads, counted once per row object: an edit copies only the rows it touches (ADR 0019),
 * so the Project's colors after a stroke cost its rows, not every bead (ticket 0677). */
const rowColors = new WeakMap<Record<number, string>, readonly string[]>()

function colorsOfRow(row: Record<number, string>): readonly string[] {
  let colors = rowColors.get(row)
  if (!colors) {
    colors = [...new Set(Object.values(row))]
    rowColors.set(row, colors)
  }
  return colors
}

/** Every color on either layer, each once, in the order the layers hold them. */
export function projectColors(project: Layered): string[] {
  const colors = new Set<string>()
  for (const beads of [beadsOfLayer(project, 'canvas'), beadsOfLayer(project, 'frame') ?? {}]) {
    for (const row of Object.values(beads)) {
      for (const color of colorsOfRow(row)) colors.add(color)
    }
  }
  return [...colors]
}

/** Whether two states of a Project hold the same beads on both layers (ADR 0066). A layer neither touched costs
 * nothing: its maps are the same object. */
export function sameBeads(a: Layered, b: Layered): boolean {
  const same = (x: BeadMap | undefined, y: BeadMap | undefined) => x === y || !anyChangedPosition(x ?? {}, y ?? {})
  return same(beadsOfLayer(a, 'canvas'), beadsOfLayer(b, 'canvas')) && same(beadsOfLayer(a, 'frame'), beadsOfLayer(b, 'frame'))
}

/** Whether two states of a Project hold the same Frame and beads: the Frame's place, size, Weave, name, shape, settings
 * and turn, its shown and Folded beads, and the Canvas's. How a held Frame change (ticket 0640) knows it came back to
 * where it began, and so is no Undo step. */
export function sameLayers(a: Layered, b: Layered): boolean {
  const [x, y] = [frameOf(a), frameOf(b)]
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
    (x.folded === y.folded || !anyChangedPosition(x.folded ?? {}, y.folded ?? {}))
  )
}

/** A dense grid of cells as a Frame the size of the grid holding them, on an empty upright Canvas woven alike: what the
 * Convert image preview, the Homepage's pictures and a test's hand-made block of beads are drawn from. */
export function framedGrid(grid: Grid, layer: Weave & Partial<Pick<LayerFields, 'beadId' | 'bead'>> = { technique: DEFAULT_TECHNIQUE }): Layered {
  const { cell: _cell, technique, techniqueSettings, beadId = DEFAULT_BEAD.id, ...bead } = layer
  const own = { ...weaveOf({ technique, techniqueSettings }), beadId, ...bead }
  const beads = beadsFromColors(grid.map((row) => row.map((cell) => cell.color)))
  return {
    layers: [
      { id: 'canvas', name: '', ...own, beads: {}, orientation: 0 },
      { id: 'frame', ...own, row: 0, column: 0, columns: grid[0]?.length ?? 0, rows: grid.length, beads, rowProgress: { direction: 'rows', currentRow: 0, currentColumn: 0 } },
    ],
  }
}
