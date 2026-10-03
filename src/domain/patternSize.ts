import { beadPitchMm, type Bead } from './beads'
import { sizeOf, type Sized } from './canvas'
import { computeGridDimensions, rotationSwapsAxes, toMillimeters, type GridDimensions, type Rotation, type SizeUnit } from './grid'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'

/** A size as the New Pattern form states it: a number of beads across and down, or a real-world size in mm/cm. */
export interface StatedSize {
  width: number
  height: number
  unit: SizeUnit
}

/**
 * The grid a stated size works out to. Beads are the columns and rows directly; mm/cm are converted once, through the
 * chosen Bead's footprint, and then forgotten (ADR 0017) — the Pattern keeps only the grid this returns.
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

/** A grid's Estimated size in mm (CONTEXT.md): width first, as seen on screen. */
export interface EstimatedSizeMm {
  widthMm: number
  heightMm: number
}

/**
 * A Pattern's Estimated size (CONTEXT.md, ADR 0017): one Bead's size multiplied by how many of them there are across
 * and down — the exact inverse of gridFromSize's mm conversion, so a stated 30mm never estimates back to something
 * other than about 30mm. Deliberately not Technique-aware: it ignores peyote's tighter row packing, thread slack and
 * tension, which is why it is only ever shown as an estimate.
 *
 * Width and height follow the rotated view, the way summarizePattern's do: a quarter turn either way swaps them.
 */
export function estimatedSizeMm(pattern: Sized & { rotation?: Rotation }, bead: Bead): EstimatedSizeMm {
  const { columns, rows } = sizeOf(pattern)
  const widthMm = columns * beadPitchMm(bead)
  const heightMm = rows * bead.heightMm
  return pattern.rotation !== undefined && rotationSwapsAxes(pattern.rotation) ? { widthMm: heightMm, heightMm: widthMm } : { widthMm, heightMm }
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

/** At most two decimals, with any trailing zeros dropped -- a Bead's own pitch (e.g. 1.65mm from a width correction) shown exactly rather than rounded to one. */
function trimmedMm(value: number, decimal: string): string {
  return String(Number(value.toFixed(2))).replace('.', decimal)
}

/**
 * The New Pattern form's Unit picker conversion row (ticket 179): each axis' bead count times that Bead's own
 * millimetre pitch (see beadPitchMm, bead.heightMm), ending in the same combined Estimated size formatSizeMm already
 * renders elsewhere in the form -- "100×1.5 × 100×2.2 ≈ 15.0 × 15.0 cm". The same mathematical-only caveat as
 * estimatedSizeMm (CONTEXT.md's Estimated size) applies: no Technique packing, thread slack or tension, so this is
 * always shown next to a tooltip saying a real result may differ.
 */
export function formatSizeConversion(grid: GridDimensions, bead: Bead, labels: SizeUnitLabels, locale: Locale = 'en'): string {
  const decimal = decimalSign(locale)
  const beadWidth = trimmedMm(beadPitchMm(bead), decimal)
  const beadHeight = trimmedMm(bead.heightMm, decimal)
  const total = formatSizeMm(estimatedSizeMm(grid, bead), labels, locale)
  return `${grid.columns}×${beadWidth} × ${grid.rows}×${beadHeight} ≈ ${total}`
}
