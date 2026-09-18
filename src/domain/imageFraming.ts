import type { Bead } from './beads'
import {
  gridHeightPx,
  gridWidthPx,
  rowHeightPx,
  type GridDimensions,
  type Technique,
} from './grid'

/**
 * The framing step of Convert image (ticket 58, ADR 0010): the frame is the Pattern itself, fixed at its stated
 * real-world size, and the picture is scaled and panned underneath it.
 *
 * Everything here works in the frame's own millimetres. That is the one space in which the Pattern's real size, the
 * Bead's footprint and the Technique's grid geometry all mean the same thing, so a cell's true centre (see
 * grid.ts's cellCenter) can be turned straight into the picture pixel underneath it.
 */

/**
 * 100% is the scale at which the picture just covers the frame, and it is also the minimum: zooming out past it would
 * leave a band of the frame unfilled, and an unfilled cell reads as a deliberate hole in the finished piece rather
 * than as an artifact of fitting a picture (ADR 0010).
 *
 * Deliberately its own range rather than grid.ts's MIN_ZOOM/MAX_ZOOM/clampZoom, which the Pattern editor's own canvas
 * zoom owns (0.25–3, fit-to-box at reset): the two mean different things, and one function bent to serve both would
 * make either one's range a change to the other's behaviour.
 */
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

/** The frame: the Pattern's real-world footprint in millimetres. */
export interface FrameSizeMm {
  widthMm: number
  heightMm: number
}

/**
 * The frame's real-world size: the Pattern grid's own footprint, taking each cell at the Bead's millimetre footprint
 * and each row at the Technique's spacing. Physical size rather than cell count (ADR 0010), so Delica's 1.6 × 1.3mm
 * cell gives a frame the shape the finished piece will have instead of a square one it never was.
 */
export function frameSizeMm(
  technique: Technique,
  dimensions: GridDimensions,
  bead: Pick<Bead, 'widthMm' | 'heightMm'>,
): FrameSizeMm {
  return {
    widthMm: gridWidthPx(technique, dimensions.columns, bead.widthMm),
    heightMm: gridHeightPx(technique, dimensions.rows, bead.heightMm),
  }
}

/**
 * Millimetres per source pixel at the smallest scale that still covers the frame — the framing step's 100%. A picture
 * smaller than the frame is upscaled by this rather than left to fill part of it.
 */
export function coverScaleMm(image: ImageSize, frame: FrameSizeMm): number {
  return Math.max(frame.widthMm / image.width, frame.heightMm / image.height)
}

/**
 * Where the picture is, as a fraction of how far it can move in each direction: 0 is flush with the frame's left/top
 * edge, 1 with its right/bottom, 0.5 centred. Stored as a fraction rather than as millimetres so it stays valid with
 * no re-clamping when the zoom changes or the size fields grow the frame — there is no such thing as an out-of-range
 * pan, only one that means "as far that way as this picture goes".
 */
export interface PanFraction {
  x: number
  y: number
}

export const CENTERED_PAN: PanFraction = { x: 0.5, y: 0.5 }

/** Where the picture sits under the frame right now, in the frame's own millimetres. */
export interface FramingView {
  /** Millimetres per source pixel. */
  scaleMm: number
  /** The picture's top-left corner, measured from the frame's own top-left corner. Never above 0: the picture covers. */
  offsetXMm: number
  offsetYMm: number
  pictureWidthMm: number
  pictureHeightMm: number
}

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * The picture's position and scale under the frame, for a zoom (a multiple of the cover scale, see CONVERT_MIN_ZOOM)
 * and a pan fraction. The picture always covers the frame, by construction: the scale starts at cover, and the offset
 * can only range over the overhang there actually is.
 */
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
    offsetXMm: -clampFraction(pan.x) * rangeXMm,
    offsetYMm: -clampFraction(pan.y) * rangeYMm,
    pictureWidthMm,
    pictureHeightMm,
  }
}

/** A pixel of the source picture. */
export interface SourcePixel {
  x: number
  y: number
}

/**
 * The picture pixel under a point given in the frame's own millimetres (the frame's top-left corner is the origin, and
 * a point outside the frame is perfectly meaningful — that is how the framing preview shows the picture around it).
 * Undefined when the point falls outside the picture altogether.
 */
export function sourcePixelAt(
  view: FramingView,
  image: ImageSize,
  xMm: number,
  yMm: number,
): SourcePixel | undefined {
  const x = Math.floor((xMm - view.offsetXMm) / view.scaleMm)
  const y = Math.floor((yMm - view.offsetYMm) / view.scaleMm)

  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return undefined
  }
  return { x, y }
}

/**
 * How many bead cells the framing preview renders at most. The preview shows the picture around the frame as beads
 * too, so that the crop can be judged, and at a high zoom the picture reaches far past the frame — a 60 × 90 frame at
 * 800% would be eight frames wide and eight tall, which is 64 times the DOM of the Pattern itself (the preview renders
 * a positioned element per bead, the same as PatternGrid). This caps that: the surrounding context shrinks to fit,
 * evenly in both directions, and the frame itself is always rendered whole even when the Pattern alone is past the cap.
 *
 * Tighter than what the Pattern editor will happily render (a 60 × 90 Pattern is 5,400 cells and opens fine), because
 * this reflows on every pointer move of a drag rather than once when a Pattern is opened: the budget is set by what can
 * be re-rendered smoothly, not by what can be displayed.
 */
export const PREVIEW_MAX_CELLS = 12000

/**
 * The block of bead cells the framing preview draws, and where the frame sits inside it. The lattice is the frame's
 * own cell grid extended outward by a margin of cells on each side, so a cell of the lattice is a cell of the Pattern
 * offset by that margin.
 */
export interface PreviewLattice {
  columns: number
  rows: number
  /** Which lattice column holds the frame's column 0. */
  frameColumn: number
  /**
   * Which lattice row holds the frame's row 0. Always even, so a lattice row has the same parity as the frame row it
   * holds and an offset Technique's half-cell stagger runs unbroken across the frame's edge.
   */
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
  bead: Pick<Bead, 'widthMm' | 'heightMm'>
  technique: Technique
}

/**
 * The preview's lattice for a given view: the frame plus as much of the picture as hangs over it, capped at
 * PREVIEW_MAX_CELLS. The margin is the same on both sides of an axis (the larger of the two overhangs), so the bead
 * lattice stays put while the picture is panned instead of jumping a cell as the overhang moves from one side to the
 * other.
 *
 * At the cover scale the whole picture nearly always fits inside the cap, so the framing step opens showing all of it.
 * Zoomed in, the surround is what gets trimmed — the part of the picture furthest from the crop being judged, and still
 * reachable by panning.
 */
export function previewLattice({
  view,
  frame,
  dimensions,
  bead,
  technique,
}: PreviewLatticeInput): PreviewLattice {
  const overhangX = Math.max(-view.offsetXMm, view.offsetXMm + view.pictureWidthMm - frame.widthMm)
  const overhangY = Math.max(-view.offsetYMm, view.offsetYMm + view.pictureHeightMm - frame.heightMm)

  const wantedColumns = Math.max(0, Math.ceil(overhangX / bead.widthMm))
  const wantedRows = Math.max(0, Math.ceil(overhangY / rowHeightPx(technique, bead.heightMm)))

  const fit = marginFit(dimensions, wantedColumns, wantedRows)
  const frameColumn = Math.floor(wantedColumns * fit)
  // Rounded down to an even number of rows, so the frame keeps its own row parity (see PreviewLattice.frameRow).
  const frameRow = 2 * Math.floor((wantedRows * fit) / 2)

  return {
    columns: dimensions.columns + frameColumn * 2,
    rows: dimensions.rows + frameRow * 2,
    frameColumn,
    frameRow,
  }
}
