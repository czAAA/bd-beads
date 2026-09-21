import { beadLabel, beadPitchMm, type Bead } from './beads'
import { computeGridDimensions, toMillimeters, type GridDimensions, type SizeUnit } from './grid'

/**
 * The most cells (columns × rows) a Pattern may be created with or grown to (ADR 0017). It limits the product, so
 * neither side has a maximum of its own: 500 × 10 is fine and 200 × 200 is not. One constant, shared by the New Pattern
 * form, Convert image and Resize, so they can't disagree about where the line is.
 */
export const MAX_PATTERN_CELLS = 10_000

/** Whether a grid this size is past MAX_PATTERN_CELLS. */
export function isOverCellCap({ columns, rows }: GridDimensions): boolean {
  return columns * rows > MAX_PATTERN_CELLS
}

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
 * Width and height follow the rotated view, the way summarizePattern's do: rotating swaps them.
 */
export function estimatedSizeMm(pattern: GridDimensions & { rotated?: boolean }, bead: Bead): EstimatedSizeMm {
  const widthMm = pattern.columns * beadPitchMm(bead)
  const heightMm = pattern.rows * bead.heightMm
  return pattern.rotated ? { widthMm: heightMm, heightMm: widthMm } : { widthMm, heightMm }
}

export interface SizeUnitLabels {
  mm: string
  cm: string
}

/** At most one decimal, with a whole number shown without a trailing ".0". */
function trimmedOneDecimal(value: number): string {
  return String(Number(value.toFixed(1)))
}

/** A tenth of a centimetre is a whole millimetre, so rounding the mm first rounds half up, where dividing first would leave 1.65 to float representation. */
function inCentimetres(mm: number): string {
  return (Math.round(mm) / 10).toFixed(1)
}

/**
 * "3.3 × 6.6 cm": cm with one decimal, or mm when a side is under 10mm (a small piece reads better in mm than as
 * "0.6 cm"). Both sides share the unit. A side that only rounds up to 10mm counts as 10mm, so the unit doesn't flip on
 * a value the reader can't see the difference of.
 */
export function formatSizeMm({ widthMm, heightMm }: EstimatedSizeMm, labels: SizeUnitLabels): string {
  const smallest = Math.round(Math.min(widthMm, heightMm) * 10) / 10
  if (smallest < 10) {
    return `${trimmedOneDecimal(widthMm)} × ${trimmedOneDecimal(heightMm)} ${labels.mm}`
  }
  return `${inCentimetres(widthMm)} × ${inCentimetres(heightMm)} ${labels.cm}`
}

/**
 * The wording of a refusal for a size past MAX_PATTERN_CELLS, as language-neutral templates (see the i18n `sizeCap`
 * entry). `{count}`, `{limit}`, `{bead}`, `{size}` and `{unit}` are filled in by sizeCapRefusal.
 */
export interface SizeCapMessages {
  /** For a size in beads: how many beads it is against the limit. */
  beads: string
  /** For mm/cm: how tall the Pattern can be at its current width. */
  tall: string
  /** For mm/cm when the width alone is over the limit: how wide it can be at its current height. */
  wide: string
}

export interface SizeCapContext {
  /** The unit the person is working in — the message speaks in it. */
  unit: SizeUnit
  /** The grid the stated size works out to. */
  dimensions: GridDimensions
  /** The Bead the size was converted through; named in mm/cm messages. Without one there is nothing to name, so the message falls back to beads. */
  bead?: Bead
  unitLabels: SizeUnitLabels
  /** A BCP 47 tag for the thousands separator; English when omitted. */
  locale?: string
}

/** Rounds down to a tenth, so the suggestion, converted back through the same Bead, never lands above the cap. */
function floorToTenth(value: number): number {
  return Math.floor(value * 10 + 1e-9) / 10
}

/**
 * The refusal message for a size past the cap, or undefined when it's within it. It speaks in the unit the person is
 * working in and is never only a bare cell count: in beads it says how many, in mm/cm it names the Bead and how far the
 * other side can go at the current one. The suggested maximum, typed back in, is accepted.
 *
 * Shared by the New Pattern form and Resize (ADR 0017), which states its size in beads.
 */
export function sizeCapRefusal(messages: SizeCapMessages, context: SizeCapContext): string | undefined {
  const { unit, dimensions, bead, unitLabels, locale = 'en' } = context
  if (!isOverCellCap(dimensions)) {
    return undefined
  }

  const format = (value: number) => value.toLocaleString(locale)
  const fill = (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (placeholder, key: string) => values[key] ?? placeholder)

  if (unit === 'beads' || !bead) {
    return fill(messages.beads, {
      count: format(dimensions.columns * dimensions.rows),
      limit: format(MAX_PATTERN_CELLS),
    })
  }

  const wide = dimensions.columns > MAX_PATTERN_CELLS
  const maxMm = wide
    ? Math.floor(MAX_PATTERN_CELLS / dimensions.rows) * beadPitchMm(bead)
    : Math.floor(MAX_PATTERN_CELLS / dimensions.columns) * bead.heightMm
  const size = floorToTenth(unit === 'cm' ? maxMm / 10 : maxMm)

  return fill(wide ? messages.wide : messages.tall, {
    bead: beadLabel(bead),
    limit: format(MAX_PATTERN_CELLS),
    size: String(size),
    unit: unitLabels[unit],
  })
}
