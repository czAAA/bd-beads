import type { Bead } from './beads'
import type { Technique } from './weave'
import { sizeOf, type FrameSheet } from './canvas'
import { frameSizeMm } from './frameShape'
import { computeGridDimensions, rotationSwapsAxes, toMillimeters, type GridDimensions, type SizeUnit } from './grid'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'
import { frameOf, quarterTurnOf, type Layered } from './layerRecord'
import { frameWeave } from './layerWeave'

/** A size as the New Project form states it: a number of beads across and down, or a real-world size in mm/cm. */
export interface StatedSize {
  width: number
  height: number
  unit: SizeUnit
}

/** The positions a stated size works out to. mm/cm go through the chosen Bead's footprint, laid on the Technique's thread
 * (ticket 0734), once and are forgotten (ADR 0026). */
export function gridFromSize(size: StatedSize, bead: Bead, technique: Technique): GridDimensions {
  if (size.unit === 'beads') {
    return { columns: Math.max(1, Math.round(size.width)), rows: Math.max(1, Math.round(size.height)) }
  }

  return computeGridDimensions(
    { widthMm: toMillimeters(size.width, size.unit), heightMm: toMillimeters(size.height, size.unit) },
    bead,
    technique,
  )
}

/** One side of a Pattern in mm, "10.5" / "10,5": at most one decimal, no trailing ".0", in the language's decimal
 * sign (ticket 342). */
export function formatMm(mm: number, locale: Locale = 'en'): string {
  return trimmedOneDecimal(mm, decimalSign(locale))
}

/** What a Frame's size is measured from beside its rectangle: its Frame shape, and a Custom frame's settings and turn. */
type Shaped = Partial<Pick<FrameSheet, 'shape' | 'settings' | 'quarterTurns'>>

/** A grid's Estimated size in mm (CONTEXT.md): width first, as seen on screen. */
export interface EstimatedSizeMm {
  widthMm: number
  heightMm: number
}

// A Project's Estimated size (CONTEXT.md, ADR 0026): the Bead laid on its Technique's thread times beads across and down
// (ticket 0734), the exact inverse of gridFromSize's mm conversion. No stagger, tension or Drop, hence only an estimate.
// Width and height follow the rotated view, as summarizeProject's do. A bare grid or Selection says its Technique.
export function estimatedSizeMm(project: Layered, bead: Bead): EstimatedSizeMm
export function estimatedSizeMm(project: GridDimensions & Shaped, bead: Bead, technique: Technique): EstimatedSizeMm
export function estimatedSizeMm(project: (GridDimensions & Shaped) | Layered, bead: Bead, technique?: Technique): EstimatedSizeMm {
  const { columns, rows } = sizeOf(project)
  const whole = 'layers' in project
  // The Frame's own shape when there is one (ticket 0592): a Custom frame's shape is what is measured.
  const woven: Shaped = whole ? (frameOf(project) ?? {}) : project
  const sheet = { shape: woven.shape, settings: woven.settings, quarterTurns: woven.quarterTurns, columns, rows, technique: whole ? frameWeave(project).technique : technique! }
  const { widthMm, heightMm } = frameSizeMm(sheet, bead)
  return whole && rotationSwapsAxes(quarterTurnOf(project)) ? { widthMm: heightMm, heightMm: widthMm } : { widthMm, heightMm }
}

export interface SizeUnitLabels {
  mm: string
  cm: string
}

/** At most one decimal, with a whole number shown without a trailing ".0", in the language's own decimal sign
 * (writing.md). */
function trimmedOneDecimal(value: number, decimal: string): string {
  return String(Math.round(value * 10) / 10).replace('.', decimal)
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
    return formatSizeInMm({ widthMm, heightMm }, labels.mm, locale)
  }
  return `${inCentimetres(widthMm, decimal)} × ${inCentimetres(heightMm, decimal)} ${labels.cm}`
}

/** "120 × 80 mm" / "16,5 × 44 мм": always mm, never switching to cm, where sizes are set side by side (the Frame panel
 * and Replace Bead, ticket 0687); at most one decimal, in the language's decimal sign. */
export function formatSizeInMm({ widthMm, heightMm }: EstimatedSizeMm, mm: string, locale: Locale = 'en'): string {
  return `${formatMm(widthMm, locale)} × ${formatMm(heightMm, locale)} ${mm}`
}

/** The unit a Schema size is stated in (ticket 342): a count of beads, or mm. */
export type SchemaSizeUnit = 'beads' | 'mm'

/** Whether a stated width and height mean a size: both above zero, and whole numbers when counted in beads. */
export function isSizeStated(width: number, height: number, unit: SchemaSizeUnit): boolean {
  const stated = width > 0 && height > 0
  return unit === 'beads' ? stated && Number.isInteger(width) && Number.isInteger(height) : stated
}
