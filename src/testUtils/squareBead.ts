import { beadPitchMm, type Bead } from '../domain/beads'

/** The Bead with a square, unrounded cell (as high as its pitch is wide): for tests of what a Bead's width alone decides,
 * such as reading one Bead's beads through millimetres in another, where a real outline would leave a gap at every corner. */
export function squareBead(bead: Bead): Bead {
  return { ...bead, heightMm: beadPitchMm(bead), formFactor: { ...bead.formFactor, roundness: 0 } }
}

/** The Bead drawn `scale` times as wide and as tall: a Frame woven in it draws shorter than the rows it names on a Canvas
 * in the original (ADR 0066, ticket 0665). */
export function scaledBead(bead: Bead, scale: number): Bead {
  return { ...bead, widthMm: bead.widthMm * scale, heightMm: bead.heightMm * scale, ...(bead.widthCorrectionMm === undefined ? {} : { widthCorrectionMm: bead.widthCorrectionMm * scale }) }
}
