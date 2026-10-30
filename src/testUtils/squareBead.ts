import { beadPitchMm, type Bead } from '../domain/beads'

/** The Bead with a square, unrounded cell (as high as its pitch is wide): for tests of what a Bead's width alone decides,
 * such as reading one Bead's beads through millimetres in another, where a real outline would leave a gap at every corner. */
export function squareBead(bead: Bead): Bead {
  return { ...bead, heightMm: beadPitchMm(bead), formFactor: { ...bead.formFactor, roundness: 0 } }
}
