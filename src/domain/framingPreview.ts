import { channelsOf } from './imageColors'
import { NO_COLOR, type ConvertedImage } from './imageConversion'
import type { PreviewLattice } from './imageFraming'
import type { GridDimensions } from './grid'

/**
 * What color each bead of the Convert image framing preview shows (ticket 104, ADR 0018), for a lattice sampled into
 * packed colors (see sampleLatticePacked): row by row, a `#rrggbb` for a bead, or undefined for one that stays empty (a
 * cell off the picture, or on a pixel too transparent to weave).
 *
 * Two ways to arrive at them, because the exact one is too slow to run on every move of a drag: reducing a whole
 * lattice's colors costs more than the frame budget on its own. So while the picture is moving the preview keeps the
 * colors the conversion had when the move began and puts each bead to the nearest of them (approximatePreviewColors);
 * whenever the picture is at rest — the drag ends, or pauses — it is worked out exactly (exactPreviewColors).
 */
export type PreviewColors = (string | undefined)[]

/**
 * A function from a packed color to the nearest of `colors` — by the same straight-line RGB distance imageColors's
 * nearestColor uses, with the same tie going to the earlier color — that remembers what it has answered. A picture has
 * far fewer distinct colors than beads, so this costs a search per distinct color rather than per bead, and (unlike
 * nearestColor) reads each of `colors` once rather than once per bead.
 */
export function nearestColorLookup(colors: readonly string[]): (packed: number) => string | undefined {
  const candidates = colors.map((hex) => channelsOf(hex))
  const answers = new Map<number, string | undefined>()

  return (packed) => {
    if (packed === NO_COLOR) {
      return undefined
    }
    if (answers.has(packed)) {
      return answers.get(packed)
    }

    const r = (packed >> 16) & 0xff
    const g = (packed >> 8) & 0xff
    const b = packed & 0xff
    let best: number | undefined
    let bestDistance = Infinity
    candidates.forEach((candidate, index) => {
      // Squared, which orders distances the same way the square root does and stays exact in integers.
      const distance = (r - candidate.r) ** 2 + (g - candidate.g) ** 2 + (b - candidate.b) ** 2
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

/**
 * The exact colors of a lattice at rest: inside the frame, the Project a Create would make (its grid, reduced to the
 * count of colors asked for); around it, the nearest of the Image colors that conversion found, so the surround reads
 * as part of the same bead picture rather than as unquantized pixels.
 */
export function exactPreviewColors(
  sampled: Int32Array,
  lattice: PreviewLattice,
  dimensions: GridDimensions,
  converted: ConvertedImage,
): PreviewColors {
  const nearest = nearestColorLookup(converted.imageColors)
  const colors: PreviewColors = new Array(lattice.rows * lattice.columns)

  for (let row = 0; row < lattice.rows; row += 1) {
    const frameRow = row - lattice.frameRow
    const insideRows = frameRow >= 0 && frameRow < dimensions.rows
    for (let column = 0; column < lattice.columns; column += 1) {
      const frameColumn = column - lattice.frameColumn
      const inFrame = insideRows && frameColumn >= 0 && frameColumn < dimensions.columns
      const at = row * lattice.columns + column
      colors[at] = inFrame
        ? (converted.grid[frameRow]![frameColumn]!.color ?? undefined)
        : nearest(sampled[at]!)
    }
  }

  return colors
}

/** The colors of a lattice while the picture is being moved: every bead, the frame's included, the nearest of the colors held from before the move. */
export function approximatePreviewColors(sampled: Int32Array, held: readonly string[]): PreviewColors {
  const nearest = nearestColorLookup(held)
  return Array.from(sampled, (packed) => nearest(packed))
}
