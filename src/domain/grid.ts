import { beadPitchMm, type Bead } from './beads'

/** A real-world length unit. */
export type PhysicalUnit = 'mm' | 'cm'

/** What a New Project's size can be stated in: a count of beads, or a real-world length converted to beads once (ADR
 * 0026). */
export type SizeUnit = 'beads' | PhysicalUnit

// A view-only quarter-turn (ticket 171, extending ticket 28): clockwise degrees. Purely cosmetic, like
// Project.rotation: the grid never turns, only its on-screen (and printed/exported) presentation.
export type Rotation = 0 | 90 | 180 | 270

// Whether this rotation swaps which grid axis runs across the screen: true for a quarter turn either way (90°/270°),
// false for 0°/180°. The rule every on-screen axis mapping shares (Estimated size, Row direction, the Frame's
// Width and Height).
export function rotationSwapsAxes(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270
}

export interface PhysicalSizeMm {
  widthMm: number
  heightMm: number
}

export interface GridDimensions {
  columns: number
  rows: number
}

export function toMillimeters(value: number, unit: PhysicalUnit): number {
  return unit === 'cm' ? value * 10 : value
}

/** Whole beads for a length: always rounded up (ticket 342), so the piece is never smaller than asked; float noise
 * on an exact multiple is not a bead. */
function beadsFor(lengthMm: number, beadMm: number): number {
  return Math.max(1, Math.ceil(lengthMm / beadMm - 1e-9))
}

/** The grid a real-world size needs, a typed mm value always rounding up to the next whole bead (ticket 342). */
export function computeGridDimensions(size: PhysicalSizeMm, bead: Bead): GridDimensions {
  const columns = beadsFor(size.widthMm, beadPitchMm(bead))
  const rows = beadsFor(size.heightMm, bead.heightMm)
  return { columns, rows }
}

// The canvas box's largest on-screen size (ticket 16); it only grows to this, so a smaller Project gets a box its own
// shape (ticket 18). Raised from 480 (editing tools left the left panel, ADR 0021), then from 640, which opened
// ordinary Projects (a few dozen columns/rows) zoomed below 100%. Bigger Projects open fit-to-box.
export const CANVAS_MAX_PX = 900

/** The two layers of a Project (ADR 0066): the Canvas, and the Frame laid over it. */
export type Layer = 'canvas' | 'frame'

export interface GridPosition {
  row: number
  column: number
  /** The layer a pointer hit named (ADR 0066): where the Frame draws shorter than the rows it names, a Frame bead and a
   * Canvas bead share a position. Left out where the position alone says it. */
  layer?: Layer
}

// A cell to show a hover preview on (ticket 23). `color` overrides the single preview color for this cell, making the
// preview multi-color for a pasted block (ticket 31); without it the cell takes the preview's color.
export interface PreviewCell extends GridPosition {
  color?: string
}

/** A stable string key for a grid position, for deduping/indexing positions in a Set or Map. */
export function positionKey(position: GridPosition): string {
  return `${position.row},${position.column}`
}

/** The Zoom floor (ADR 0033): the same on every screen.
 * @internal Tests zoom to the floor. */
export const MIN_ZOOM = 0.1
/** The Zoom ceiling, the same on every screen.
 * @internal Tests zoom to the ceiling. */
export const MAX_ZOOM = 4
const ZOOM_STEP = 0.1
/** The Zoom range as the whole percents the level label and the buttons' disabled states compare against. */
export const MIN_ZOOM_PERCENT = Math.round(MIN_ZOOM * 100)
export const MAX_ZOOM_PERCENT = Math.round(MAX_ZOOM * 100)

// The next button step from a zoom: the next whole multiple of ZOOM_STEP (10%) above or below, so buttons walk 10, 20,
// 30 ... from wherever a fit, wheel or pinch left the level (43% goes to 50% in, 40% out); a level on a rung moves one
// rung.
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const stepPercent = Math.round(ZOOM_STEP * 100)
  const percent = Math.round(zoom * 100)
  const nextPercent = direction === 1 ? (Math.floor(percent / stepPercent) + 1) * stepPercent : (Math.ceil(percent / stepPercent) - 1) * stepPercent
  return clampZoom(nextPercent / 100)
}

/** Keeps a zoom inside the usable range (MIN_ZOOM to MAX_ZOOM), at whole-percent precision so the displayed level
 * and the applied scale agree. */
export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}
