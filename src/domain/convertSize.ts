import type { Bead } from './beads'
import { clamp } from './clamp'
import type { GridDimensions } from './grid'
import type { PixelData } from './imageConversion'
import type { ImageSize } from './imageFraming'
import { describeWeave, type Technique, type TechniqueSettings } from './weave'
import { fillBlanks } from './fillBlanks'
import type { Locale } from './locale'
import { estimatedSizeMm, formatMm, formatSizeMm } from './projectSize'

/** How the Convert image wizard sizes a Schema (spec 0645, ticket 0747): one Width in beads over the part of the
 * picture to weave; the height follows the picture, exactly on a mark and through the Bead between them. */

/** The part of the picture to weave, in picture pixels from its top-left corner: the whole picture, or A part. */
export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

/** The Convert image wizard's five numbered sections, in the step rail's order (ConvertImage card). */
export const CONVERT_STEPS = ['picture', 'bead', 'size', 'colors', 'review'] as const
export type ConvertStep = (typeof CONVERT_STEPS)[number]

/** The part's handles on the preview, in Tab order round it (ConvertImage card): four corners, four edge bars. */
export const CROP_HANDLES = ['topLeft', 'top', 'topRight', 'right', 'bottomRight', 'bottom', 'bottomLeft', 'left'] as const
export type CropHandle = (typeof CROP_HANDLES)[number]

/** The whole picture as the part: weave Whole picture. */
export function fullCrop({ width, height }: ImageSize): PixelCrop {
  return { x: 0, y: 0, width, height }
}

/** The fewest pixels a part has on a side (ConvertImage card). */
const MIN_PART_PX = 8

/** A part a whole number of pixels, on the picture, at least MIN_PART_PX a side. */
function clampPart(part: PixelCrop, image: ImageSize): PixelCrop {
  const axis = (start: number, size: number, length: number) => {
    const least = Math.min(MIN_PART_PX, length)
    const extent = clamp(Math.round(size), least, length)
    return [clamp(Math.round(start), 0, length - extent), extent] as const
  }
  const [x, width] = axis(part.x, part.width, image.width)
  const [y, height] = axis(part.y, part.height, image.height)
  return { x, y, width, height }
}

/** Where A part starts (ConvertImage card): 10% in from each edge, so there is something to drag at once. */
export function partInset(image: ImageSize): PixelCrop {
  const inX = Math.round(image.width * 0.1)
  const inY = Math.round(image.height * 0.1)
  return clampPart({ x: inX, y: inY, width: image.width - inX * 2, height: image.height - inY * 2 }, image)
}

/** The edges a handle holds. */
function edgesOf(handle: CropHandle) {
  const lower = handle.toLowerCase()
  return {
    left: lower.includes('left'),
    right: lower.includes('right'),
    top: handle.startsWith('top'),
    bottom: handle.startsWith('bottom'),
  }
}

/** The part with a handle's edges moved by picture pixels (ConvertImage card): whole pixels, on the picture, never
 * under MIN_PART_PX a side. */
export function partMoved(part: PixelCrop, handle: CropHandle, dx: number, dy: number, image: ImageSize): PixelCrop {
  const edges = edgesOf(handle)
  let left = part.x
  let right = part.x + part.width
  let top = part.y
  let bottom = part.y + part.height
  if (edges.left) left = Math.min(left + dx, right - MIN_PART_PX)
  if (edges.right) right = Math.max(right + dx, left + MIN_PART_PX)
  if (edges.top) top = Math.min(top + dy, bottom - MIN_PART_PX)
  if (edges.bottom) bottom = Math.max(bottom + dy, top + MIN_PART_PX)
  const moved = { x: Math.round(left), y: Math.round(top), width: Math.round(right) - Math.round(left), height: Math.round(bottom) - Math.round(top) }
  // A moved edge stays put at the picture's edge; the other edges keep their place.
  return clampPart(
    {
      x: edges.left ? clamp(moved.x, 0, part.x + part.width - MIN_PART_PX) : moved.x,
      y: edges.top ? clamp(moved.y, 0, part.y + part.height - MIN_PART_PX) : moved.y,
      width: edges.left ? part.x + part.width - clamp(moved.x, 0, part.x + part.width - MIN_PART_PX) : Math.min(moved.width, image.width - moved.x),
      height: edges.top ? part.y + part.height - clamp(moved.y, 0, part.y + part.height - MIN_PART_PX) : Math.min(moved.height, image.height - moved.y),
    },
    image,
  )
}

/** Beads on a side beyond which converting and drawing take longer: the Large Schema note, and where the Width slider
 * stops (ConvertImage card). */
export const LARGE_SCHEMA_BEADS = 300

/** Whether a Schema is large enough for the Large Schema note: more than LARGE_SCHEMA_BEADS on a side. */
export function isLargeSchema({ columns, rows }: GridDimensions): boolean {
  return columns > LARGE_SCHEMA_BEADS || rows > LARGE_SCHEMA_BEADS
}

/** The least Width the slider offers. */
const MIN_WIDTH_BEADS = 8
/** Under this many pixels wide a part may be made up to ENLARGE_TIMES wider than its pixels, so small pixel art can
 * still be made bigger. */
const ENLARGE_UNDER_PX = 75
const ENLARGE_TIMES = 4
/** The blocks a mark may stand for: one bead for a whole n × n pixels. */
const BLOCKS_PX = [32, 16, 8, 4, 2, 1]
/** The enlargements a mark may stand for: one pixel for a whole k × k beads. */
const ENLARGEMENTS = [2, 4]

interface WidthRange {
  min: number
  max: number
}

/** The Width slider's ends for a part (ConvertImage card): 8 beads to one bead per pixel, at most the Large Schema
 * line; a part under 75 px wide goes up to 4× its pixels.
 * @internal Reached through sizingFor; its test checks the cap and the 4× rule on their own. */
export function widthRange(part: ImageSize): WidthRange {
  const max = Math.max(1, Math.min(LARGE_SCHEMA_BEADS, part.width < ENLARGE_UNDER_PX ? part.width * ENLARGE_TIMES : part.width))
  return { min: Math.min(MIN_WIDTH_BEADS, max), max }
}

/** A mark on the Width slider: a Width where one bead is a whole n × n pixels (pixelsPerBead n), or, enlarging, one
 * pixel a whole k × k beads (pixelsPerBead 1/k). */
interface SizeMark {
  width: number
  pixelsPerBead: number
}

/** The marks of a part, narrowest first: every block its width divides by and every enlargement, inside the range.
 * @internal Reached through sizingFor; its test checks which blocks and enlargements make a mark on their own. */
export function sizeMarks(part: ImageSize): SizeMark[] {
  const { min, max } = widthRange(part)
  const inRange = (mark: SizeMark) => mark.width >= min && mark.width <= max
  const blocks = BLOCKS_PX.filter((n) => part.width % n === 0).map((n) => ({ width: part.width / n, pixelsPerBead: n }))
  const enlarged = ENLARGEMENTS.map((k) => ({ width: part.width * k, pixelsPerBead: 1 / k }))
  return [...blocks, ...enlarged].filter(inRange)
}

/** The beads a part makes on a mark: its pixels divided by the block both ways, a part block at the edge counting as
 * a whole one. The allowance keeps float noise on an exact multiple from adding a bead. */
function markGrid(part: ImageSize, mark: SizeMark): GridDimensions {
  return { columns: mark.width, rows: Math.max(1, Math.ceil(part.height / mark.pixelsPerBead - 1e-9)) }
}

/** What the Size section asks the rule: the part, the Width in beads, and the Bead the height follows between marks. */
export interface SizingInput {
  part: ImageSize
  width: number
  bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>
  technique: Technique
  techniqueSettings?: TechniqueSettings
}

/** What the rule gives: the slider's ends and marks, the Width kept inside them, the grid, the mark it sits on if
 * any, and the picture pixels each bead stands for along each side. */
export interface Sizing {
  range: WidthRange
  marks: SizeMark[]
  width: number
  grid: GridDimensions
  mark?: SizeMark
  pixelsPerBead: { x: number; y: number }
}

/** The one sizing rule (ticket 0747): on a mark the grid is the pixel grid, exact; between marks the height follows the
 * picture's physical shape through the Bead (proportionalSide). */
export function sizingFor({ part, width, bead, technique, techniqueSettings }: SizingInput): Sizing {
  const range = widthRange(part)
  const marks = sizeMarks(part)
  const kept = clamp(Math.round(width), range.min, range.max)
  const mark = marks.find((candidate) => candidate.width === kept)
  if (mark) {
    return { range, marks, width: kept, grid: markGrid(part, mark), mark, pixelsPerBead: { x: mark.pixelsPerBead, y: mark.pixelsPerBead } }
  }
  const grid = { columns: kept, rows: proportionalSide(part, bead, technique, { columns: kept }, techniqueSettings) }
  return { range, marks, width: kept, grid, pixelsPerBead: { x: part.width / grid.columns, y: part.height / grid.rows } }
}

/** The most beads the starting Width gives on the long side. */
const STARTING_MAX_BEADS = 150

/** The wizard's first proposal (ConvertImage card): one bead per pixel where that mark is in range and keeps inside
 * the Large Schema line both ways, as pixel art is drawn at the bead count it wants; else the largest mark giving at
 * most 150 beads on the long side; with no such mark, 150 beads on the long side, or the max where that is smaller. */
export function startingWidth(part: ImageSize): number {
  const { min, max } = widthRange(part)
  const marks = sizeMarks(part)
  const exact = marks.find((mark) => mark.pixelsPerBead === 1 && !isLargeSchema(markGrid(part, mark)))
  if (exact) return exact.width
  const fitting = marks.filter((mark) => {
    const grid = markGrid(part, mark)
    return Math.max(grid.columns, grid.rows) <= STARTING_MAX_BEADS
  })
  const best = fitting.at(-1)
  if (best) return best.width
  const longSide = part.width >= part.height ? STARTING_MAX_BEADS : Math.round((STARTING_MAX_BEADS * part.width) / part.height)
  return clamp(longSide, min, max)
}

/** The other side, in whole beads, of a Frame with the picture's physical shape through the Bead and the Technique's
 * row spacing, from the side that was set (spec 0645).
 * @internal Only sizingFor calls it; its test checks the shape on each Technique and a non-square Bead directly. */
export function proportionalSide(
  image: ImageSize,
  bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>,
  technique: Technique,
  side: { columns: number } | { rows: number },
  techniqueSettings?: TechniqueSettings,
): number {
  const step = describeWeave({ technique, techniqueSettings }).stepMm(bead)
  const beads = 'columns' in side
    ? (side.columns * step.across * image.height) / image.width / step.down
    : (side.rows * step.down * image.width) / image.height / step.across
  return Math.max(1, Math.round(beads))
}

/** A picture's pixels moved to new places: `from` names the source pixel of each target pixel. */
function remap(image: PixelData, width: number, height: number, from: (x: number, y: number) => number): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = from(x, y) * 4
      const target = (y * width + x) * 4
      data[target] = image.data[source]!
      data[target + 1] = image.data[source + 1]!
      data[target + 2] = image.data[source + 2]!
      data[target + 3] = image.data[source + 3]!
    }
  }
  return { width, height, data }
}

/** Turn 90° (spec 0645): the picture a quarter turn clockwise, before sampling, so its width and height swap. */
export function turnPicture(image: PixelData): PixelData {
  return remap(image, image.height, image.width, (x, y) => (image.height - 1 - x) * image.width + y)
}

/** Flip (spec 0645): the picture mirrored left to right, before sampling. */
export function flipPicture(image: PixelData): PixelData {
  return remap(image, image.width, image.height, (x, y) => y * image.width + (image.width - 1 - x))
}

/** The words the result line is made of (ConvertImage card), in the app's language. */
export interface ResultLabels {
  /** "{columns}×{rows} beads" */
  grid: string
  /** "Each {n}×{n} px square of your picture = 1 bead" */
  exact: string
  /** "About {x} × {y} px of your picture = 1 bead" */
  approximate: string
  /** "1 px of your picture = {n} × {n} beads" */
  perPixel: string
  mm: string
  cm: string
}

/** What a conversion makes, for the result line: the sizing, measured through the Bead. */
export interface ResultInput {
  bead: Bead
  technique: Technique
  sizing: Pick<Sizing, 'grid' | 'mark' | 'pixelsPerBead'>
}

/** The result line (ConvertImage card): "32×24 beads", "5.1 × 3.1 cm" and "Each 8×8 px square of your picture = 1 bead" on a mark,
 * "1 px of your picture = 2 × 2 beads" on an enlarging one, "About 4.3 × 3.5 px of your picture = 1 bead" between marks. */
export function convertResult({ bead, technique, sizing }: ResultInput, labels: ResultLabels, locale: Locale = 'en'): { grid: string; measured: string; ratio: string } {
  const { grid, mark, pixelsPerBead } = sizing
  // Pixels per bead read as formatMm reads a length: one decimal at most, in the language's decimal sign.
  const oneDecimal = (value: number) => formatMm(value, locale)
  let ratioText: string
  if (!mark) ratioText = fillBlanks(labels.approximate, { x: oneDecimal(pixelsPerBead.x), y: oneDecimal(pixelsPerBead.y) })
  else if (mark.pixelsPerBead < 1) ratioText = fillBlanks(labels.perPixel, { n: Math.round(1 / mark.pixelsPerBead) })
  else ratioText = fillBlanks(labels.exact, { n: mark.pixelsPerBead })
  return {
    grid: fillBlanks(labels.grid, { columns: grid.columns, rows: grid.rows }),
    measured: formatSizeMm(estimatedSizeMm(grid, bead, technique), labels, locale),
    ratio: ratioText,
  }
}
