import { channelsOf } from './imageColors'
import { NO_COLOR, type ConvertedImage } from './imageConversion'
import type { PreviewLattice } from './imageFraming'
import type { GridDimensions } from './grid'

// What color each bead of the Convert image framing preview shows (ticket 104, ADR 0018): a `#rrggbb` per bead,
// undefined if empty. The exact reduction is too slow per drag move, so while the picture moves each bead takes the
// nearest color from drag start (approximatePreviewColors); at rest it is exact (exactPreviewColors).
export type PreviewColors = (string | undefined)[]

// A memoised function from a packed color to the nearest of `colors`, by the same RGB distance and earlier-color tie as
// imageColors's nearestColor. A picture has far fewer distinct colors than beads, so this searches once per distinct
// color and reads `colors` once, not per bead.
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

// The exact colors of a lattice at rest: inside the frame, the Project a Create would make (reduced to the count asked
// for); around it, the nearest of the Image colors that conversion found, so the surround reads as part of the same
// bead picture, not unquantized pixels.
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

/** The colors of a lattice while the picture is being moved: every bead, the frame's included, the nearest of the
 * colors held from before the move. */
export function approximatePreviewColors(sampled: Int32Array, held: readonly string[]): PreviewColors {
  const nearest = nearestColorLookup(held)
  return Array.from(sampled, (packed) => nearest(packed))
}
