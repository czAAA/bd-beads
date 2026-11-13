import type { Bead } from './beads'
import { clamp } from './clamp'
import type { GridDimensions } from './grid'
import type { PixelData } from './imageConversion'
import type { ImageSize } from './imageFraming'
import { describeWeave, type Technique, type TechniqueSettings } from './weave'
import { fillBlanks } from './fillBlanks'
import type { Locale } from './locale'
import type { PictureKind } from './pictureKind'
import { estimatedSizeMm, formatMm, formatSizeMm } from './projectSize'

/** How the Convert image wizard sizes a Schema (spec 0645, tickets 0747, 0757): a Width and a Height in beads over the
 * part of the picture to weave, linked by default (one sets the other through the picture's shape, exactly on a mark
 * and through the Bead between them) or set on their own, which stretches the picture. */

/** The part of the picture to weave, in picture pixels from its top-left corner: the whole picture, or A part. */
export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

/** The part's handles on the preview, in Tab order round it (ConvertImage card): four corners, four edge bars. */
export const CROP_HANDLES = ['topLeft', 'top', 'topRight', 'right', 'bottomRight', 'bottom', 'bottomLeft', 'left'] as const
export type CropHandle = (typeof CROP_HANDLES)[number]

/** The whole picture as the part: weave Whole picture. */
export function fullCrop({ width, height }: ImageSize): PixelCrop {
  return { x: 0, y: 0, width, height }
}

/** The part turned with the picture a quarter turn clockwise (Turn 90°, ticket 0898): the same piece of the picture,
 * in the turned picture's pixels. `image` is the picture before the turn. */
export function partTurned(part: PixelCrop, image: ImageSize): PixelCrop {
  return { x: image.height - part.y - part.height, y: part.x, width: part.height, height: part.width }
}

/** The part flipped with the picture left to right (Flip left to right, ticket 0898). */
export function partFlipped(part: PixelCrop, image: ImageSize): PixelCrop {
  return { ...part, x: image.width - part.x - part.width }
}

/** Beads on a side beyond which converting and drawing take longer: the Large Schema note, and where the Width slider
 * stops (ConvertImage card). */
export const LARGE_SCHEMA_BEADS = 300

/** Whether a Schema is large enough for the Large Schema note: more than LARGE_SCHEMA_BEADS on a side. */
export function isLargeSchema({ columns, rows }: GridDimensions): boolean {
  return columns > LARGE_SCHEMA_BEADS || rows > LARGE_SCHEMA_BEADS
}

/** The least a slider offers, on either side. */
const MIN_SIDE_BEADS = 8
/** Under this many pixels on a side a part may be made up to ENLARGE_TIMES larger than its pixels, so small pixel art
 * can still be made bigger. */
const ENLARGE_UNDER_PX = 75
const ENLARGE_TIMES = 4
/** The blocks a mark may stand for: one bead for a whole n × n pixels. */
const BLOCKS_PX = [32, 16, 8, 4, 2, 1]
/** The enlargements a mark may stand for: one pixel for a whole k × k beads. */
const ENLARGEMENTS = [2, 4]

interface SizeRange {
  min: number
  max: number
}

/** A slider's ends for a side of so many pixels (ConvertImage card): 8 beads to one bead per pixel, at most the Large
 * Schema line; a side under 75 px goes up to 4× its pixels. */
function sideRange(pixels: number): SizeRange {
  const max = Math.max(1, Math.min(LARGE_SCHEMA_BEADS, pixels < ENLARGE_UNDER_PX ? pixels * ENLARGE_TIMES : pixels))
  return { min: Math.min(MIN_SIDE_BEADS, max), max }
}

/** The Width slider's ends for a part (ConvertImage card): 8 beads to one bead per pixel, at most the Large Schema
 * line; a part under 75 px wide goes up to 4× its pixels.
 * @internal Reached through sizingFor and startingSize; its test checks the cap and the 4× rule on their own. */
export function widthRange(part: ImageSize): SizeRange {
  return sideRange(part.width)
}

/** The Height slider's ends for a part: the same rule as Width's, over the part's height.
 * @internal Reached through sizingFor and startingSize; its test checks the rule over the height on its own. */
export function heightRange(part: ImageSize): SizeRange {
  return sideRange(part.height)
}

/** A mark on the Width slider: a Width where one bead is a whole n × n pixels (pixelsPerBead n), or, enlarging, one
 * pixel a whole k × k beads (pixelsPerBead 1/k). */
interface SizeMark {
  width: number
  pixelsPerBead: number
}

/** A mark on the Height slider, the same way. */
interface HeightMark {
  height: number
  pixelsPerBead: number
}

/** The marks along one side of so many pixels, fewest beads first: every block it divides by and every enlargement,
 * inside the range. */
function sideMarks(pixels: number): { beads: number; pixelsPerBead: number }[] {
  const { min, max } = sideRange(pixels)
  const blocks = BLOCKS_PX.filter((n) => pixels % n === 0).map((n) => ({ beads: pixels / n, pixelsPerBead: n }))
  const enlarged = ENLARGEMENTS.map((k) => ({ beads: pixels * k, pixelsPerBead: 1 / k }))
  return [...blocks, ...enlarged].filter((mark) => mark.beads >= min && mark.beads <= max)
}

/** The Width marks of a part, narrowest first: every block its width divides by and every enlargement, inside the range.
 * @internal Reached through sizingFor; its test checks which blocks and enlargements make a mark on their own. */
export function sizeMarks(part: ImageSize): SizeMark[] {
  return sideMarks(part.width).map((mark) => ({ width: mark.beads, pixelsPerBead: mark.pixelsPerBead }))
}

/** The beads a part makes on a mark: its pixels divided by the block both ways, a part block at the edge counting as
 * a whole one. The allowance keeps float noise on an exact multiple from adding a bead. */
function markGrid(part: ImageSize, mark: SizeMark): GridDimensions {
  return { columns: mark.width, rows: Math.max(1, Math.ceil(part.height / mark.pixelsPerBead - 1e-9)) }
}

/** The side of the piece a slider sets. */
export type SizeSide = 'width' | 'height'

/** What the Size section asks the rule: the part, the Width and the Height in beads, how they are linked, and the Bead
 * the other side follows through. */
export interface SizingInput {
  part: ImageSize
  width: number
  /** Only read where Height is set: unlinked, or linked with Height leading. */
  height?: number
  /** The chain (ticket 0757): linked by default, one side leads and the other follows through the picture's shape;
   * unlinked, each side is set on its own and the picture stretches. */
  linked?: boolean
  /** The side that leads while linked: the one the person moved last. Width by default. */
  lead?: SizeSide
  bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>
  technique: Technique
  techniqueSettings?: TechniqueSettings
}

/** What the rule gives: each slider's ends and marks, each side kept inside its ends, the grid, the mark it sits on if
 * any, and the picture pixels each bead stands for along each side. Linked, the Height marks are the Width marks'
 * grids' heights; unlinked, each side keeps its own. */
export interface Sizing {
  range: SizeRange
  marks: SizeMark[]
  heightRange: SizeRange
  heightMarks: HeightMark[]
  width: number
  height: number
  grid: GridDimensions
  mark?: SizeMark
  pixelsPerBead: { x: number; y: number }
}

/** The one sizing rule (tickets 0747, 0757). Linked: on a mark the grid is the pixel grid, exact; between marks the led
 * side is what was set and the other follows the picture's shape through the Bead (proportionalSide). Unlinked: each
 * side is its own, so the picture stretches; it is on a mark only where both sides stand for the same block. */
export function sizingFor({ part, width, height, linked = true, lead = 'width', bead, technique, techniqueSettings }: SizingInput): Sizing {
  const widths = widthRange(part)
  const heights = heightRange(part)
  const marks = sizeMarks(part)
  const shape = (side: { columns: number } | { rows: number }) => proportionalSide(part, bead, technique, side, techniqueSettings)
  const onMark = (candidate: SizeMark) => ({
    grid: markGrid(part, candidate),
    mark: candidate,
    pixelsPerBead: { x: candidate.pixelsPerBead, y: candidate.pixelsPerBead },
  })
  const between = (grid: GridDimensions) => ({ grid, pixelsPerBead: { x: part.width / grid.columns, y: part.height / grid.rows } })
  const whole = (made: { grid: GridDimensions; mark?: SizeMark; pixelsPerBead: { x: number; y: number } }, heightMarks: HeightMark[]): Sizing => ({
    range: widths,
    marks,
    heightRange: heights,
    heightMarks,
    width: made.grid.columns,
    height: made.grid.rows,
    ...made,
  })

  if (!linked) {
    const columns = clamp(Math.round(width), widths.min, widths.max)
    const rows = clamp(Math.round(height ?? heights.max), heights.min, heights.max)
    const heightMarks = sideMarks(part.height).map((mark) => ({ height: mark.beads, pixelsPerBead: mark.pixelsPerBead }))
    const across = marks.find((candidate) => candidate.width === columns)
    const down = heightMarks.find((candidate) => candidate.height === rows)
    const made = between({ columns, rows })
    return whole(across && down && across.pixelsPerBead === down.pixelsPerBead ? { ...made, mark: across } : made, heightMarks)
  }

  const paired = marks.map((candidate) => ({ candidate, grid: markGrid(part, candidate) }))
  const heightMarks = paired
    .filter(({ grid }) => grid.rows >= heights.min && grid.rows <= heights.max)
    .map(({ candidate, grid }) => ({ height: grid.rows, pixelsPerBead: candidate.pixelsPerBead }))
  if (lead === 'width') {
    const columns = clamp(Math.round(width), widths.min, widths.max)
    const mark = marks.find((candidate) => candidate.width === columns)
    return whole(mark ? onMark(mark) : between({ columns, rows: shape({ columns }) }), heightMarks)
  }
  const rows = clamp(Math.round(height ?? heights.max), heights.min, heights.max)
  const pair = paired.find(({ grid }) => grid.rows === rows)
  if (pair) return whole(onMark(pair.candidate), heightMarks)
  const followed = shape({ rows })
  const columns = clamp(followed, widths.min, widths.max)
  // A Width held at an end of its slider takes the Height with it, so the shape is kept.
  return whole(between({ columns, rows: columns === followed ? rows : shape({ columns }) }), heightMarks)
}

/** The Width a beginner's piece opens at (ticket 0863): about 60 beads, 9 cm in a 1.5 mm Bead. */
const OPENING_WIDTH_BEADS = 60
/** How far from OPENING_WIDTH_BEADS a mark may be and still be the opening Width: a fifth either way. */
const OPENING_MARK_REACH = OPENING_WIDTH_BEADS / 5

/** What the converter opens at (tickets 0863, 0889): a small piece. Flat art opens on the mark nearest 60 beads wide
 * if one is near, else at 60, or at one bead per pixel if narrower; a photo at 60 (its marks are no truer than any
 * Width), or as wide as it allows. Height takes the picture's shape, so it reads true if moved or the shape let go. */
export function startingSize(part: ImageSize, kind: PictureKind = 'flat'): { width: number; height: number } {
  const widths = widthRange(part)
  const near = sizeMarks(part)
    .filter((mark) => Math.abs(mark.width - OPENING_WIDTH_BEADS) <= OPENING_MARK_REACH)
    .sort((a, b) => Math.abs(a.width - OPENING_WIDTH_BEADS) - Math.abs(b.width - OPENING_WIDTH_BEADS))[0]
  const flatWidth = part.width <= OPENING_WIDTH_BEADS ? part.width : (near?.width ?? OPENING_WIDTH_BEADS)
  const wanted = kind === 'photo' ? OPENING_WIDTH_BEADS : flatWidth
  const width = clamp(wanted, widths.min, widths.max)
  const heights = heightRange(part)
  return { width, height: clamp(Math.round((width * part.height) / part.width), heights.min, heights.max) }
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
