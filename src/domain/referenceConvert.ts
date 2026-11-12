import { colorAt, frameContains, withColors, type BeadChange, type BeadMap } from './canvas'
import { clamp } from './clamp'
import { matchFoundColors, type TargetColor } from './convertColors'
import { footprintOf } from './footprint'
import type { GridPosition } from './grid'
import { reducePictureColors } from './imageColors'
import { MAX_IMAGE_COLORS, MIN_IMAGE_COLORS, NO_COLOR, packedToHex, pixelPackedAt, type PixelData } from './imageConversion'
import { frameGeometryOf, positionInLayer } from './layers'
import { beadsOfLayer, frameOf, withLayer } from './layerRecord'
import { layersAlike } from './layerWeave'
import { touch, type Grid, type Project } from './project'

// Convert to beads (ReferenceImage card, ticket 0883): the reference image read at the centre of every Canvas position
// it covers, its colors reduced and matched as Convert image does (ADR 0010), and laid where the picture lies.

/** A Canvas position on the picture, and where: fractions of the picture's width and height from its top-left. */
interface PicturePoint extends GridPosition {
  u: number
  v: number
}

/** A position and the packed color the picture has under its centre, NO_COLOR where it lets the Canvas through. */
export interface SampledPosition extends GridPosition {
  color: number
}

/** The picture's color under each position's centre (pixelPackedAt: see-through below half alpha). */
export function sampledColors(pixels: PixelData, points: readonly PicturePoint[]): SampledPosition[] {
  const { width, height } = pixels
  return points.map(({ row, column, u, v }) => ({
    row,
    column,
    color: pixelPackedAt(pixels, Math.min(width - 1, Math.floor(u * width)), Math.min(height - 1, Math.floor(v * height))),
  }))
}

/** What a conversion makes: a bead for every position the picture doesn't let through, the bead colors it uses (most
 * beads first) and how many colors the picture's beads sample, the Colors stepper's most before its 256 cap. */
export interface ReferenceConversion {
  changes: (BeadChange & { color: string })[]
  colors: string[]
  colorsFound: number
}

/** The sampled colors reduced to `maxColors` and matched to `targets`, none for Exact (convertColors' matchFoundColors). */
export function convertSampled(sampled: readonly SampledPosition[], maxColors: number, targets: readonly TargetColor[] | undefined): ReferenceConversion {
  const hexes = new Map<number, string>()
  const counts = new Map<string, number>()
  for (const { color } of sampled) {
    if (color === NO_COLOR) continue
    let hex = hexes.get(color)
    if (hex === undefined) {
      hex = packedToHex(color)
      hexes.set(color, hex)
    }
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  const reduced = reducePictureColors(counts, clamp(maxColors, MIN_IMAGE_COLORS, MAX_IMAGE_COLORS))
  const found = matchFoundColors(reduced, targets, new Map())
  const result = new Map(found.map((color) => [color.pictureHex, color.result?.hex]))
  const changes: ReferenceConversion['changes'] = []
  for (const { row, column, color } of sampled) {
    const made = color === NO_COLOR ? undefined : result.get(reduced.byHex.get(hexes.get(color)!)!)
    if (made) changes.push({ row, column, color: made })
  }
  const colors = [...new Set(found.flatMap((color) => (color.result ? [color.result.hex] : [])))]
  return { changes, colors, colorsFound: counts.size }
}

/** The changes split by the layer they land on: the Canvas, and in its own positions a Frame laid out as the Canvas is
 * (a grid woven alike); under any other Frame nothing, as it hides the Canvas there and has no positions to match. */
function byLayer(project: Project, changes: readonly BeadChange[]): { canvas: BeadChange[]; frame: BeadChange[] } {
  const covered = footprintOf(project)
  const frame = frameOf(project)
  const geometry = frame && layersAlike(project) ? frameGeometryOf(project) : undefined
  const split = { canvas: [] as BeadChange[], frame: [] as BeadChange[] }
  for (const change of changes) {
    if (!covered || !frameContains(covered, change)) {
      split.canvas.push(change)
      continue
    }
    const own = positionInLayer(project, 'frame', change)
    if (geometry?.grid && geometry.hasPosition(own)) split.frame.push({ ...own, color: change.color })
  }
  return split
}

/** The Project with the conversion's beads laid where the picture lies, replacing what was on those positions. */
export function withConvertedBeads(project: Project, changes: readonly BeadChange[]): Project {
  const { canvas, frame } = byLayer(project, changes)
  let next = project
  if (canvas.length > 0) next = withLayer(next, 'canvas', { beads: withColors(beadsOfLayer(next, 'canvas'), canvas) })
  if (frame.length > 0) next = withLayer(next, 'frame', { beads: withColors(beadsOfLayer(next, 'frame')!, frame) })
  return next === project ? project : touch(next, {})
}

/** How many beads already on the positions the conversion paints it replaces: "Replaces {n} beads already there." */
export function beadsReplaced(project: Project, changes: readonly BeadChange[]): number {
  const { canvas, frame } = byLayer(project, changes)
  const held = (beads: BeadMap | undefined, list: BeadChange[]) => (beads ? list.filter(({ row, column }) => colorAt(beads, row, column) !== null).length : 0)
  return held(beadsOfLayer(project, 'canvas'), canvas) + held(beadsOfLayer(project, 'frame'), frame)
}

/** Convert image's beads from the reference image's All settings, its grid's first row and column at `corner` (the box the
 * picture covers), as a conversion's changes: Add to Canvas (ConvertImage card, ticket 0883). */
export function gridChanges(grid: Grid, corner: GridPosition): ReferenceConversion['changes'] {
  return grid.flatMap((cells, row) => cells.flatMap(({ color }, column) => (color ? [{ row: corner.row + row, column: corner.column + column, color }] : [])))
}
