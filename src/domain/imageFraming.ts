import { beadPitchMm, type Bead } from './beads'
import { clamp } from './clamp'
import { type GridDimensions } from './grid'
import { describeWeave, rowCycle, slowFramingCells, type Technique, type TechniqueSettings } from './weave'

/** The framing step of Convert image (ticket 58, ADR 0010): the frame is the Project at its real-world size, the
 * picture scaled and panned beneath it. All in frame millimetres, where a cell's true centre maps to a picture
 * pixel. */

/** 100% is the scale at which the picture just covers the frame, and the minimum: an unfilled cell would read as a
 * deliberate hole (ADR 0010). Not grid.ts's MIN_ZOOM/MAX_ZOOM, which the editor canvas owns; sharing would couple
 * them. */
export const CONVERT_MIN_ZOOM = 1
export const CONVERT_MAX_ZOOM = 8
export const CONVERT_ZOOM_STEP = 0.25

/** Keeps a framing zoom inside its range, at whole-percent precision so the level shown is the level applied. */
export function clampConvertZoom(value: number): number {
  return Math.min(CONVERT_MAX_ZOOM, Math.max(CONVERT_MIN_ZOOM, Math.round(value * 100) / 100))
}

/** A picture's own pixel dimensions — all the framing math needs of it. */
export interface ImageSize {
  width: number
  height: number
}

/** The frame: the Project's real-world footprint in millimetres. */
export interface FrameSizeMm {
  widthMm: number
  heightMm: number
}

/** The frame's real-world size: cells at the Bead's mm footprint, rows at the Technique's spacing. Physical size,
 * not cell count (ADR 0010), so Delica's 1.6 x 1.3mm cell gives the finished piece's real shape. */
export function frameSizeMm(
  technique: Technique,
  dimensions: GridDimensions,
  bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>,
): FrameSizeMm {
  const { width, height } = describeWeave({ technique }).blockExtent(dimensions.columns, dimensions.rows, beadPitchMm(bead), bead.heightMm)
  return { widthMm: width, heightMm: height }
}

/** Millimetres per source pixel at the smallest scale that still covers the frame (the framing step's 100%);
 * a smaller picture is upscaled by this.
 * @internal Its test checks the framing step's 100% on its own. */
export function coverScaleMm(image: ImageSize, frame: FrameSizeMm): number {
  return Math.max(frame.widthMm / image.width, frame.heightMm / image.height)
}

/** Where the picture is, as a fraction of its travel: 0 flush left/top, 1 right/bottom, 0.5 centred. A fraction, so
 * it stays valid with no re-clamping when zoom changes or the size fields grow the frame. */
export interface PanFraction {
  x: number
  y: number
}

export const CENTERED_PAN: PanFraction = { x: 0.5, y: 0.5 }

/** Where the picture sits under the frame right now, in the frame's own millimetres. */
export interface FramingView {
  /** Millimetres per source pixel. */
  scaleMm: number
  /** The picture's top-left corner, measured from the frame's own top-left corner. Never above 0: the picture
   * covers. */
  offsetXMm: number
  offsetYMm: number
  pictureWidthMm: number
  pictureHeightMm: number
}

/** The picture's position and scale under the frame, for a zoom (multiple of the cover scale) and a pan fraction.
 * Always covers the frame: scale starts at cover and the offset ranges only over the overhang. */
export function framingView(
  image: ImageSize,
  frame: FrameSizeMm,
  zoom: number,
  pan: PanFraction,
): FramingView {
  const scaleMm = coverScaleMm(image, frame) * zoom
  const pictureWidthMm = image.width * scaleMm
  const pictureHeightMm = image.height * scaleMm

  // Rounding can leave the cover dimension a hair short of the frame; a negative range would push the picture off it.
  const rangeXMm = Math.max(0, pictureWidthMm - frame.widthMm)
  const rangeYMm = Math.max(0, pictureHeightMm - frame.heightMm)

  return {
    scaleMm,
    offsetXMm: -clamp(pan.x, 0, 1) * rangeXMm,
    offsetYMm: -clamp(pan.y, 0, 1) * rangeYMm,
    pictureWidthMm,
    pictureHeightMm,
  }
}

/** Most bead cells the framing preview renders, redrawn on every drag move (ticket 104). High zoom reaches far past the
 * frame (800% is 64x the beads), so the surround shrinks evenly to fit; the frame is always whole.
 * @internal Its test checks the preview stays under it. */
export const PREVIEW_MAX_CELLS = 12000

/** Whether a grid this size in this Technique risks slow framing: the Frame's own grid (not the margin) reaches its
 * Technique's slow-framing limit (ticket 61). */
export function isSlowFramingSize(technique: Technique, dimensions: GridDimensions): boolean {
  return dimensions.columns * dimensions.rows >= slowFramingCells(technique)
}

/** The block of bead cells the framing preview draws: the frame's grid extended by a margin of cells on each side,
 * so a lattice cell is a Project cell offset by that margin. */
export interface PreviewLattice {
  columns: number
  rows: number
  /** Which lattice column holds the frame's column 0. */
  frameColumn: number
  /** Which lattice row holds the frame's row 0. Always a whole number of the shift's cycles (even, or 2N on
   * brick stitch), so an offset Technique's half-cell stagger runs unbroken across the frame's edge. */
  frameRow: number
}

/** The largest fraction of the wanted margins that keeps the lattice inside the cell budget. */
function marginFit(dimensions: GridDimensions, wantedColumns: number, wantedRows: number): number {
  const { columns, rows } = dimensions
  // (columns + 2 f mc) * (rows + 2 f mr) <= PREVIEW_MAX_CELLS, solved for the largest f in 0..1.
  const a = 4 * wantedColumns * wantedRows
  const b = 2 * (columns * wantedRows + rows * wantedColumns)
  const c = columns * rows - PREVIEW_MAX_CELLS

  if (c >= 0) {
    return 0
  }
  if (a === 0) {
    return b === 0 ? 1 : Math.min(1, -c / b)
  }
  return Math.min(1, (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a))
}

/** The picture, the frame and the Technique's geometry — what the lattice is worked out from. */
export interface PreviewLatticeInput {
  view: FramingView
  frame: FrameSizeMm
  dimensions: GridDimensions
  bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>
  technique: Technique
  /** Its settings (ticket 0625): the Brick block; one left out is its default. */
  techniqueSettings?: TechniqueSettings
}

/** The preview's lattice for a view: the frame plus the overhanging picture, capped at PREVIEW_MAX_CELLS. The margin
 * is equal on both sides of an axis (larger overhang) so the lattice doesn't jump while panning; when capped, the
 * surround furthest from the crop is trimmed. */
export function previewLattice({
  view,
  frame,
  dimensions,
  bead,
  technique,
  techniqueSettings,
}: PreviewLatticeInput): PreviewLattice {
  const overhangX = Math.max(-view.offsetXMm, view.offsetXMm + view.pictureWidthMm - frame.widthMm)
  const overhangY = Math.max(-view.offsetYMm, view.offsetYMm + view.pictureHeightMm - frame.heightMm)

  const description = describeWeave({ technique, techniqueSettings })
  const step = description.stepMm(bead)
  const wantedColumns = Math.max(0, Math.ceil(overhangX / step.across))
  const wantedRows = Math.max(0, Math.ceil(overhangY / step.down))

  const fit = marginFit(dimensions, wantedColumns, wantedRows)
  const frameColumn = Math.floor(wantedColumns * fit)
  // Rounded down to whole cycles of the shift, so the frame keeps its place in it (see PreviewLattice.frameRow).
  // Loom has a cycle of 1 but its frame row has always been even.
  const cycle = Math.max(2, rowCycle({ technique, techniqueSettings }))
  const frameRow = cycle * Math.floor((wantedRows * fit) / cycle)

  return {
    columns: dimensions.columns + frameColumn * 2,
    rows: dimensions.rows + frameRow * 2,
    frameColumn,
    frameRow,
  }
}

/** What the preview's lattice By Pixel to bead ratio is worked out from (spec 0645). */
export interface RatioLatticeInput {
  image: ImageSize
  /** The crop, snapped to whole blocks (convertSize's snapCrop). */
  crop: { x: number; y: number; width: number; height: number }
  /** Picture pixels along one side of a bead (convertSize's pixelsPerBead). */
  pixelsPerBead: number
  dimensions: GridDimensions
  technique: Technique
  techniqueSettings?: TechniqueSettings
}

/** The preview's lattice By Pixel to bead ratio: the frame (the crop's beads) and the rest of the picture round it, in
 * whole beads each side, capped at PREVIEW_MAX_CELLS. The rows above are whole cycles of the shift (see
 * PreviewLattice.frameRow), so the top may reach a row past the picture. */
export function ratioLattice({ image, crop, pixelsPerBead, dimensions, technique, techniqueSettings }: RatioLatticeInput): PreviewLattice {
  const left = Math.round(crop.x / pixelsPerBead)
  const top = Math.round(crop.y / pixelsPerBead)
  const right = Math.max(0, Math.ceil((image.width - crop.x - crop.width) / pixelsPerBead - 1e-9))
  const bottom = Math.max(0, Math.ceil((image.height - crop.y - crop.height) / pixelsPerBead - 1e-9))

  const fit = marginFit(dimensions, (left + right) / 2, (top + bottom) / 2)
  const cycle = Math.max(2, rowCycle({ technique, techniqueSettings }))
  const frameColumn = Math.floor(left * fit)
  const frameRow = cycle * Math.ceil(Math.floor(top * fit) / cycle)

  return {
    columns: frameColumn + dimensions.columns + Math.floor(right * fit),
    rows: frameRow + dimensions.rows + Math.floor(bottom * fit),
    frameColumn,
    frameRow,
  }
}
