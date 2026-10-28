import { channelsOf, colorDistance, toOklab } from './color'
import { NO_COLOR, unpacked } from './imageConversion'
import type { PreviewLattice } from './imageFraming'
import type { GridDimensions } from './grid'
import type { Grid } from './project'

// What color each bead of the Convert image preview shows (ticket 104, ADR 0018): a `#rrggbb` per bead, undefined if
// empty. The exact reduction is too slow per drag move, so while the picture moves each bead takes the held color from
// drag start (approximatePreviewColors); at rest it is exact (exactPreviewColors).
export type PreviewColors = (string | undefined)[]

/** A memoised nearest of `colors` for a packed color, by the same colorDistance as nearestColor and earlier-color
 * tie: a picture has far fewer distinct colors than beads, so it searches once per distinct color, not per bead.
 * @internal Its test checks it matches nearestColor. */
export function nearestColorLookup(colors: readonly string[]): (packed: number) => string | undefined {
  const candidates = colors.map((hex) => toOklab(channelsOf(hex)))
  const answers = new Map<number, string | undefined>()

  return (packed) => {
    if (packed === NO_COLOR) {
      return undefined
    }
    if (answers.has(packed)) {
      return answers.get(packed)
    }

    const color = toOklab(unpacked(packed))
    let best: number | undefined
    let bestDistance = Infinity
    candidates.forEach((candidate, index) => {
      const distance = colorDistance(color, candidate)
      if (distance < bestDistance) {
        best = index
        bestDistance = distance
      }
    })

    const answer = best === undefined ? undefined : colors[best]
    answers.set(packed, answer)
    return answer
  }
}

/** What a bead outside the Frame, or any bead while the picture moves, shows (spec 0645): the result of the found color
 * nearest its picture color, so the surround reads as part of the same bead picture and an emptied color stays empty. */
export function heldColorLookup(found: readonly { pictureHex: string; result?: { hex: string } }[]): (packed: number) => string | undefined {
  const nearest = nearestColorLookup(found.map((color) => color.pictureHex))
  const results = new Map(found.map((color) => [color.pictureHex, color.result?.hex]))
  return (packed) => {
    const picture = nearest(packed)
    return picture === undefined ? undefined : results.get(picture)
  }
}

/** The exact colors of a lattice at rest: inside the frame, the Project a Create would make; around it, the held color
 * (heldColorLookup). */
export function exactPreviewColors(
  sampled: Int32Array,
  lattice: PreviewLattice,
  dimensions: GridDimensions,
  grid: Grid,
  held: (packed: number) => string | undefined,
): PreviewColors {
  const colors: PreviewColors = new Array(lattice.rows * lattice.columns)

  for (let row = 0; row < lattice.rows; row += 1) {
    const frameRow = row - lattice.frameRow
    const insideRows = frameRow >= 0 && frameRow < dimensions.rows
    for (let column = 0; column < lattice.columns; column += 1) {
      const frameColumn = column - lattice.frameColumn
      const inFrame = insideRows && frameColumn >= 0 && frameColumn < dimensions.columns
      const at = row * lattice.columns + column
      colors[at] = inFrame ? (grid[frameRow]![frameColumn]!.color ?? undefined) : held(sampled[at]!)
    }
  }

  return colors
}

/** The colors of a lattice while the picture is being moved: every bead, the frame's included, the held color. */
export function approximatePreviewColors(sampled: Int32Array, held: (packed: number) => string | undefined): PreviewColors {
  return Array.from(sampled, (packed) => held(packed))
}
