// Row done's motion on the Pattern (ticket 0730; the design system's Motion section, Row progress): the values the
// canvas draws the glint, the ruler pill's glide and Pattern done's timing by. Their CSS twins in design-values.css are
// held to these by rowMotion.test.ts.

/** Row progress motion in ms, and the glint's strongest wash. */
export const ROW_MOTION = {
  /** Each bead of the pass just finished washes in `GLINT_COLOR` and back (`--row-glint-duration`). */
  glint: 380,
  /** The gap between one bead's glint and the next, in the Row direction (`--row-glint-step`)... */
  glintStep: 24,
  /** ...shortened so the whole pass starts within this (`--row-glint-span`). */
  glintSpan: 480,
  /** The glint's strongest wash (`--row-glint-peak`). */
  glintPeak: 0.55,
  /** The finished pass takes the finished look after its glint (`--row-dim-delay`). */
  dimDelay: 520,
  /** The ruler pill and the tick glide to the next pass (`--duration-base`, `--ease-standard`). */
  glide: 200,
  /** Once every pass is done the pill and the tick fade out (Rulers card, `--ease-in`). */
  markFade: 150,
  /** From the press that marks the last pass to Pattern done (`--pattern-done-delay`). */
  patternDoneDelay: 450,
  /** From Pattern done's start to the finished passes' return to full color (`--pattern-done-shimmer-delay`)... */
  restoreDelay: 250,
  /** ...which takes this (`--pattern-done-restore`). */
  restore: 500,
  /** The first star (`--pattern-done-stars-delay`), the gap between stars (`--pattern-done-star-step`) and each
   * star's life (`--pattern-done-star`). */
  starsDelay: 1100,
  starStep: 90,
  star: 900,
} as const

/** The glint's wash, white in every theme (`--row-glint`). */
export const GLINT_COLOR = '#ffffff'

/** Where Pattern done's 14 stars light (Motion section), as fractions across and down the Frame: the approved
 * prototype's spots on its 16 by 10 Frame. */
export const PATTERN_DONE_STARS = [[1, 1], [6, 0], [12, 2], [15, 0], [3, 4], [9, 3], [14, 5], [0, 7], [5, 6], [11, 8], [7, 9], [15, 9], [2, 9], [8, 5]].map(
  ([column, row]) => ({ across: column! / 15, down: row! / 9 }),
)

/** How long Pattern done plays, from its start to the last star's end: its layer is gone after this. */
export const PATTERN_DONE_MS = ROW_MOTION.starsDelay + (PATTERN_DONE_STARS.length - 1) * ROW_MOTION.starStep + ROW_MOTION.star

/** A CSS `cubic-bezier` as a function of time, 0 to 1: the curve's x solved by bisection, which is plenty for a frame. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let [low, high] = [0, 1]
    for (let step = 0; step < 24; step++) {
      const middle = (low + high) / 2
      if (at(x1, x2, middle) < t) low = middle
      else high = middle
    }
    return at(y1, y2, (low + high) / 2)
  }
}

/** The design system's easings (`--ease-standard`, `--ease-out`, `--ease-in`). */
export const easeStandard = cubicBezier(0.2, 0, 0, 1)
export const easeOut = cubicBezier(0.2, 0.8, 0.2, 1)
export const easeIn = cubicBezier(0.4, 0, 1, 1)

/** The gap between two beads' glints along a pass of `count` beads: the step, or less so the last starts within the
 * span. */
function glintStep(count: number): number {
  return count > 1 ? Math.min(ROW_MOTION.glintStep, ROW_MOTION.glintSpan / (count - 1)) : 0
}

/** How long a pass of `count` beads glints, from the press to its last bead's end. */
export function glintMs(count: number): number {
  return glintStep(count) * Math.max(0, count - 1) + ROW_MOTION.glint
}

/** How strongly the `index`th bead of a pass of `count` is washed `elapsed` ms after the press, 0 to the peak: up to
 * it in the first 35% of its glint and back, each part eased out, as the approved prototype's keyframes. */
export function glintWash(elapsed: number, index: number, count: number): number {
  const t = (elapsed - index * glintStep(count)) / ROW_MOTION.glint
  if (t <= 0 || t >= 1) return 0
  const RISE = 0.35
  return ROW_MOTION.glintPeak * (t < RISE ? easeOut(t / RISE) : 1 - easeOut((t - RISE) / (1 - RISE)))
}
