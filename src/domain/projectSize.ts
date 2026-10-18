import { beadPitchMm, type Bead } from './beads'
import { sizeOf, type Sized } from './canvas'
import { computeGridDimensions, rotationSwapsAxes, toMillimeters, type GridDimensions, type Rotation, type SizeUnit } from './grid'
import { describeWeave, type Weave } from './weave'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'

/** A size as the New Project form states it: a number of beads across and down, or a real-world size in mm/cm. */
export interface StatedSize {
  width: number
  height: number
  unit: SizeUnit
}

const BEADS_WEAVE: Weave = { technique: 'loom' }

/** The positions a stated size works out to. mm/cm go through the chosen Bead's footprint once and are forgotten (ADR
 * 0026). Where the Technique counts Units (ticket 482) the size is whole Units, a Unit's pitch being a bead's length
 * plus its width, and comes back as the positions they take. */
export function gridFromSize(size: StatedSize, bead: Bead, weave: Weave = BEADS_WEAVE): GridDimensions {
  const description = describeWeave(weave)
  if (description.countsUnits) {
    const { across } = description.stepMm(bead)
    const units = (value: number) => Math.max(1, size.unit === 'beads' ? Math.round(value) : Math.ceil(toMillimeters(value, size.unit) / across - 1e-9))
    return description.positionsOf({ columns: units(size.width), rows: units(size.height) })
  }
  if (size.unit === 'beads') {
    return { columns: Math.max(1, Math.round(size.width)), rows: Math.max(1, Math.round(size.height)) }
  }

  return computeGridDimensions(
    { widthMm: toMillimeters(size.width, size.unit), heightMm: toMillimeters(size.height, size.unit) },
    bead,
  )
}

/** One side of a Pattern in mm, "10.5" / "10,5": at most one decimal, no trailing ".0", in the language's decimal
 * sign (ticket 342). */
export function formatMm(mm: number, locale: Locale = 'en'): string {
  return trimmedOneDecimal(mm, decimalSign(locale))
}

/** A grid's Estimated size in mm (CONTEXT.md): width first, as seen on screen. */
export interface EstimatedSizeMm {
  widthMm: number
  heightMm: number
}

// A Project's Estimated size (CONTEXT.md, ADR 0026): Bead size times beads across and down, the exact inverse of
// gridFromSize's mm conversion. Not Technique-aware (no peyote packing, slack, tension), hence only an estimate.
// Width and height follow the rotated view, as summarizeProject's do.
export function estimatedSizeMm(project: Sized & { rotation?: Rotation; technique?: Weave['technique'] }, bead: Bead): EstimatedSizeMm {
  const { columns, rows } = sizeOf(project)
  const description = describeWeave({ technique: project.technique ?? 'loom' })
  // Right-angle weave: the Units' own pitch, not a column of beads (ticket 482).
  const { width: widthMm, height: heightMm } = description.countsUnits
    ? description.blockExtent(columns, rows, beadPitchMm(bead), bead.heightMm)
    : { width: columns * beadPitchMm(bead), height: rows * bead.heightMm }
  return project.rotation !== undefined && rotationSwapsAxes(project.rotation) ? { widthMm: heightMm, heightMm: widthMm } : { widthMm, heightMm }
}

export interface SizeUnitLabels {
  mm: string
  cm: string
}

/** At most one decimal, with a whole number shown without a trailing ".0", in the language's own decimal sign
 * (writing.md). */
function trimmedOneDecimal(value: number, decimal: string): string {
  return String(Number(value.toFixed(1))).replace('.', decimal)
}

/** A tenth of a centimetre is a whole millimetre, so rounding the mm first rounds half up, where dividing first
 * would leave 1.65 to float representation. */
function inCentimetres(mm: number, decimal: string): string {
  return (Math.round(mm) / 10).toFixed(1).replace('.', decimal)
}

// "3.3 × 6.6 cm" / "3,3 × 6,6 см": cm with one decimal, or mm when a side is under 10mm; both sides share the unit.
// A side that only rounds up to 10mm counts as 10mm. `locale` picks the decimal sign (writing.md).
export function formatSizeMm({ widthMm, heightMm }: EstimatedSizeMm, labels: SizeUnitLabels, locale: Locale = 'en'): string {
  const decimal = decimalSign(locale)
  const smallest = Math.round(Math.min(widthMm, heightMm) * 10) / 10
  if (smallest < 10) {
    return `${trimmedOneDecimal(widthMm, decimal)} × ${trimmedOneDecimal(heightMm, decimal)} ${labels.mm}`
  }
  return `${inCentimetres(widthMm, decimal)} × ${inCentimetres(heightMm, decimal)} ${labels.cm}`
}

/** The unit a Schema size is stated in (ticket 342): a count of beads, or mm. */
export type SchemaSizeUnit = 'beads' | 'mm'

/** Whether a stated width and height mean a size: both above zero, and whole numbers when counted in beads. */
export function isSizeStated(width: number, height: number, unit: SchemaSizeUnit): boolean {
  const stated = width > 0 && height > 0
  return unit === 'beads' ? stated && Number.isInteger(width) && Number.isInteger(height) : stated
}

/** A size in the unit it is not stated in (ticket 342): "≈ 3.0 × 2.2 cm" in beads, "≈ 20×10 beads" in mm. */
export function formatOtherUnit(
  grid: GridDimensions,
  bead: Bead,
  unit: SchemaSizeUnit,
  labels: SizeUnitLabels & { beadsTemplate: string },
  locale: Locale = 'en',
  technique: Weave['technique'] = 'loom',
): string {
  if (unit === 'mm') {
    const { columns, rows } = describeWeave({ technique }).unitsOf(grid)
    return labels.beadsTemplate.replace('{columns}', String(columns)).replace('{rows}', String(rows))
  }
  return `≈ ${formatSizeMm(estimatedSizeMm({ ...grid, technique }, bead), labels, locale)}`
}
