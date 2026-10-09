import { beadPitchMm, type Bead } from './beads'
import { sizeOf, type Sized } from './canvas'
import { computeGridDimensions, rotationSwapsAxes, toMillimeters, type GridDimensions, type Rotation, type SizeUnit } from './grid'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'

/** A size as the New Project form states it: a number of beads across and down, or a real-world size in mm/cm. */
export interface StatedSize {
  width: number
  height: number
  unit: SizeUnit
}

/**
 * The grid a stated size works out to. Beads are the columns and rows directly; mm/cm are converted once, through the
 * chosen Bead's footprint, and then forgotten (ADR 0026) — the Project keeps only the grid this returns.
 */
export function gridFromSize(size: StatedSize, bead: Bead): GridDimensions {
  if (size.unit === 'beads') {
    return { columns: Math.max(1, Math.round(size.width)), rows: Math.max(1, Math.round(size.height)) }
  }

  return computeGridDimensions(
    { widthMm: toMillimeters(size.width, size.unit), heightMm: toMillimeters(size.height, size.unit) },
    bead,
  )
}

/** One side of a Pattern in mm, "10.5" / "10,5": at most one decimal, no trailing ".0", in the language's decimal sign (ticket 342). */
export function formatMm(mm: number, locale: Locale = 'en'): string {
  return trimmedOneDecimal(mm, decimalSign(locale))
}

/** A grid's Estimated size in mm (CONTEXT.md): width first, as seen on screen. */
export interface EstimatedSizeMm {
  widthMm: number
  heightMm: number
}

/**
 * A Project's Estimated size (CONTEXT.md, ADR 0026): one Bead's size multiplied by how many of them there are across
 * and down — the exact inverse of gridFromSize's mm conversion, so a stated 30mm never estimates back to something
 * other than about 30mm. Deliberately not Technique-aware: it ignores peyote's tighter row packing, thread slack and
 * tension, which is why it is only ever shown as an estimate.
 *
 * Width and height follow the rotated view, the way summarizeProject's do: a quarter turn either way swaps them.
 */
export function estimatedSizeMm(project: Sized & { rotation?: Rotation }, bead: Bead): EstimatedSizeMm {
  const { columns, rows } = sizeOf(project)
  const widthMm = columns * beadPitchMm(bead)
  const heightMm = rows * bead.heightMm
  return project.rotation !== undefined && rotationSwapsAxes(project.rotation) ? { widthMm: heightMm, heightMm: widthMm } : { widthMm, heightMm }
}

export interface SizeUnitLabels {
  mm: string
  cm: string
}

/** At most one decimal, with a whole number shown without a trailing ".0", in the language's own decimal sign (writing.md). */
function trimmedOneDecimal(value: number, decimal: string): string {
  return String(Number(value.toFixed(1))).replace('.', decimal)
}

/** A tenth of a centimetre is a whole millimetre, so rounding the mm first rounds half up, where dividing first would leave 1.65 to float representation. */
function inCentimetres(mm: number, decimal: string): string {
  return (Math.round(mm) / 10).toFixed(1).replace('.', decimal)
}

/**
 * "3.3 × 6.6 cm" / "3,3 × 6,6 см": cm with one decimal, or mm when a side is under 10mm (a small piece reads better in
 * mm than as "0.6 cm"). Both sides share the unit. A side that only rounds up to 10mm counts as 10mm, so the unit
 * doesn't flip on a value the reader can't see the difference of. `locale` picks the decimal sign (writing.md).
 */
export function formatSizeMm({ widthMm, heightMm }: EstimatedSizeMm, labels: SizeUnitLabels, locale: Locale = 'en'): string {
  const decimal = decimalSign(locale)
  const smallest = Math.round(Math.min(widthMm, heightMm) * 10) / 10
  if (smallest < 10) {
    return `${trimmedOneDecimal(widthMm, decimal)} × ${trimmedOneDecimal(heightMm, decimal)} ${labels.mm}`
  }
  return `${inCentimetres(widthMm, decimal)} × ${inCentimetres(heightMm, decimal)} ${labels.cm}`
}
