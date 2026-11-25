import { anyChangedPosition, beadsFromColors, colorAt, frameContains, hasBeads, sameFrame, type BeadMap } from './canvas'
import type { FrameRef, Layer } from './grid'
import { sameWeave, weaveOf } from './layerWeave'
import { beadsOfLayer, frameById, frameIdOf, framesOf, heldWeave, type Layered } from './layerRecord'
import { cellUnder } from './footprint'
import { DEFAULT_BEAD } from './beads'
import type { Grid, LayerFields } from './project'
import { DEFAULT_TECHNIQUE, type Weave } from './weave'

// What the beads on the two layers (ADR 0066) are: the one seen at a position, whether any are painted, their colors.

/** The color of the bead you see at a position: a Frame's own cell when `layer` names the Frame (its own row and
 * column), else the Canvas's, or the Frame's where it lies over a Canvas position (ADR 0066). A hex, or null where nothing is
 * painted. */
export function beadColorAt(project: Layered, row: number, column: number, layer?: Layer): string | null {
  if (layer) {
    const named = frameById(project, layer)
    return colorAt(named ? named.beads : beadsOfLayer(project, 'canvas'), row, column)
  }
  const under = framesOf(project).find((each) => frameContains(each, { row, column }))
  if (!under) return colorAt(beadsOfLayer(project, 'canvas'), row, column)
  const own = cellUnder(project, frameIdOf(under), { row, column })
  return colorAt(under.beads, own.row, own.column)
}

/** Whether the Canvas holds a bead (a Frame's own do not count). */
export function hasCanvasBeads(project: Layered): boolean {
  return hasBeads(beadsOfLayer(project, 'canvas'))
}

/** Whether the Project has a bead on either layer. */
export function hasProjectBeads(project: Layered): boolean {
  return hasBeads(beadsOfLayer(project, 'canvas')) || framesOf(project).some((frame) => hasBeads(frame.beads))
}

/** The colors of each row of beads, counted once per row object: an edit copies only the rows it touches (ADR 0019),
 * so the Project's colors after a stroke cost its rows, not every bead (ticket 0677). */
const rowColors = new WeakMap<Record<number, string>, readonly string[]>()

/** Records a row's colors worked out elsewhere, in the order `Object.values` gives them: decoding knows them from the
 * stored runs (ticket 0716). */
export function knownRowColors(row: Record<number, string>, colors: readonly string[]): void {
  rowColors.set(row, colors)
}

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
  for (const beads of [beadsOfLayer(project, 'canvas'), ...framesOf(project).map((frame) => frame.beads)]) {
    for (const row of Object.values(beads)) {
      for (const color of colorsOfRow(row)) colors.add(color)
    }
  }
  return [...colors]
}

/** Whether two states of a Project hold the same beads on every layer (ADR 0066), each Frame matched by its id. A layer
 * neither touched costs nothing: its maps are the same object. */
export function sameBeads(a: Layered, b: Layered): boolean {
  const same = (x: BeadMap | undefined, y: BeadMap | undefined) => x === y || !anyChangedPosition(x ?? {}, y ?? {})
  const ids = new Set([...framesOf(a), ...framesOf(b)].map(frameIdOf))
  return same(beadsOfLayer(a, 'canvas'), beadsOfLayer(b, 'canvas')) && [...ids].every((id) => same(beadsOfLayer(a, id), beadsOfLayer(b, id)))
}

/** Whether two states of a Project hold the same Frames and beads: each Frame's place, size, Weave, name, shape,
 * settings and turn, matched by its id (ticket 1218), its shown and Folded beads, and the Canvas's. How a held Frame
 * change (ticket 0640) knows it came back to where it began, and so is no Undo step. */
export function sameLayers(a: Layered, b: Layered): boolean {
  const ids = new Set([...framesOf(a), ...framesOf(b)].map(frameIdOf))
  return sameBeads(a, b) && [...ids].every((id) => sameFrameLayer(a, b, id))
}

/** Whether a Frame is the same in both states, beads aside: both lack it, or it lies, is woven and is shaped alike. */
function sameFrameLayer(a: Layered, b: Layered, ref: FrameRef): boolean {
  const [x, y] = [frameById(a, ref), frameById(b, ref)]
  if (!x || !y) return x === y
  const names = new Set([...Object.keys(x.settings ?? {}), ...Object.keys(y.settings ?? {})]) as Set<keyof NonNullable<typeof x.settings>>
  return (
    sameFrame(x, y) &&
    sameWeave(heldWeave(a, ref)!, heldWeave(b, ref)!) &&
    x.name === y.name &&
    x.shape === y.shape &&
    x.quarterTurns === y.quarterTurns &&
    [...names].every((name) => x.settings?.[name] === y.settings?.[name]) &&
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
      { id: 'frame', ...own, row: 0, column: 0, columns: grid[0]?.length ?? 0, rows: grid.length, beads, angle: 0, rowProgress: { way: 'down' } },
    ],
  }
}
