import type { Bead } from './beads'
import type { GridDimensions, SizeUnit } from './grid'
import { gridFromSize } from './patternSize'

/** What the Change size modal has typed so far: text, since an empty or half-typed box is a state of its own. */
export interface SizeChangeInput {
  widthText: string
  heightText: string
  unit: SizeUnit
}

/** Why typed values can't be applied. */
export type SizeChangeProblem = 'empty' | 'not-a-number' | 'not-positive' | 'not-whole' | 'no-bead'

export type SizeChangePlan =
  | { ok: false; problem: SizeChangeProblem }
  | {
      ok: true
      /** The grid the typed size works out to, from the top-left of the current one (a Resize anchored at the end). */
      target: GridDimensions
      /** Whether the new grid is smaller in either direction, so painted cells outside it are removed. */
      shrinks: boolean
      /** The typed numbers, as numbers, for the message to name in the chosen unit. */
      width: number
      height: number
    }

function problemWith(text: string, unit: SizeUnit): SizeChangeProblem | undefined {
  if (text.trim() === '') {
    return 'empty'
  }
  const value = Number(text)
  if (!Number.isFinite(value)) {
    return 'not-a-number'
  }
  if (value <= 0) {
    return 'not-positive'
  }
  return unit === 'beads' && !Number.isInteger(value) ? 'not-whole' : undefined
}

/**
 * Works out what a Change size request would do to a Pattern (CONTEXT.md's Resize, ADR 0017): the same conversion the
 * New Pattern form uses (gridFromSize), applied once to the typed size and then forgotten — the Pattern only ever keeps
 * the grid. There is no upper limit (ADR 0019). A Pattern whose Bead is unknown can only be sized in beads, since mm/cm
 * need the Bead's footprint.
 */
export function planSizeChange(current: GridDimensions, input: SizeChangeInput, bead: Bead | undefined): SizeChangePlan {
  const problem = problemWith(input.widthText, input.unit) ?? problemWith(input.heightText, input.unit)
  if (problem) {
    return { ok: false, problem }
  }
  if (input.unit !== 'beads' && !bead) {
    return { ok: false, problem: 'no-bead' }
  }

  const width = Number(input.widthText)
  const height = Number(input.heightText)
  // A beads-only conversion never reads the Bead, so an unknown one can't get in the way of it.
  const target = gridFromSize({ width, height, unit: input.unit }, bead as Bead)
  return {
    ok: true,
    target,
    shrinks: target.columns < current.columns || target.rows < current.rows,
    width,
    height,
  }
}
