import type { Bead } from './beads'
import { clamp } from './clamp'
import type { GridDimensions } from './grid'
import type { PixelData } from './imageConversion'
import { CENTERED_PAN, clampConvertZoom, coverScaleMm, type FrameSizeMm, type FramingView, type ImageSize, type PanFraction } from './imageFraming'
import { describeWeave, type Technique, type TechniqueSettings } from './weave'
import { fillBlanks } from './fillBlanks'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'
import { estimatedSizeMm, formatSizeMm } from './projectSize'

/** How the Convert image wizard sizes a Schema (spec 0645): By Pixel to bead ratio, the size read from the picture, or
 * By size, a stated size the picture is zoomed and panned under (imageFraming.ts). */
export type SizeMode = 'ratio' | 'size'

/** A Pixel to bead ratio (glossary): picture pixels : beads, one side always 1. 2:1 is every 2 × 2 pixel block one bead,
 * 1:2 every pixel 2 × 2 beads. */
export interface PixelToBeadRatio {
  pixels: number
  beads: number
}

/** The ratio chips, finest first (PixelToBeadRatio card). */
export const RATIO_PRESETS: readonly PixelToBeadRatio[] = [
  { pixels: 1, beads: 4 },
  { pixels: 1, beads: 2 },
  { pixels: 1, beads: 1 },
  { pixels: 2, beads: 1 },
  { pixels: 4, beads: 1 },
  { pixels: 8, beads: 1 },
]

/** A Custom ratio's whole number, either way (PixelToBeadRatio card's Stepper). */
export const CUSTOM_RATIO_MIN = 2
export const CUSTOM_RATIO_MAX = 32

/** Whether two ratios are the same. */
export function sameRatio(a: PixelToBeadRatio, b: PixelToBeadRatio): boolean {
  return a.pixels === b.pixels && a.beads === b.beads
}

/** Picture pixels along one side of a bead: 2 for 2:1, a half for 1:2. */
export function pixelsPerBead({ pixels, beads }: PixelToBeadRatio): number {
  return pixels / beads
}

/** The part of the picture a ratio converts, in picture pixels from its top-left corner. */
export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

/** The whole picture as a crop: where By Pixel to bead ratio starts. */
export function fullCrop({ width, height }: ImageSize): PixelCrop {
  return { x: 0, y: 0, width, height }
}

/** The Schema a ratio makes of a crop: one bead per block, a part block at the edge counting as a whole one. */
export function ratioGrid(crop: PixelCrop, ratio: PixelToBeadRatio): GridDimensions {
  const per = pixelsPerBead(ratio)
  // The allowance keeps float noise on an exact multiple from adding a bead.
  return { columns: Math.max(1, Math.ceil(crop.width / per - 1e-9)), rows: Math.max(1, Math.ceil(crop.height / per - 1e-9)) }
}

/** The pixels one block is: n for n:1, one pixel for 1:n. */
function blockPx(ratio: PixelToBeadRatio): number {
  return Math.max(1, pixelsPerBead(ratio))
}

/** An edge at the nearest block boundary, counted from the picture's corner, or at the picture's own far edge. */
function snapEdge(at: number, block: number, length: number): number {
  const onBlock = Math.round(at / block) * block
  const snapped = Math.abs(length - at) < Math.abs(onBlock - at) ? length : onBlock
  return clamp(snapped, 0, length)
}

/** A crop snapped to whole pixel blocks (ConvertImage card), so no pixel is cut in half: each edge on a block boundary
 * or the picture's edge, at least one block, all on the picture. */
export function snapCrop(crop: PixelCrop, ratio: PixelToBeadRatio, image: ImageSize): PixelCrop {
  const block = blockPx(ratio)
  const axis = (start: number, size: number, length: number) => {
    const first = Math.min(snapEdge(start, block, length), Math.max(0, length - block))
    const last = Math.max(snapEdge(start + size, block, length), Math.min(length, first + block))
    return [first, last - first] as const
  }
  const [x, width] = axis(crop.x, crop.width, image.width)
  const [y, height] = axis(crop.y, crop.height, image.height)
  return { x, y, width, height }
}

/** Under this many pixels on its long side a picture is likely pixel art, so the wizard starts By Pixel to bead ratio. */
const SMALL_PICTURE_PX = 400
/** The most beads the starting ratio gives on the long side. */
const STARTING_MAX_BEADS = 150

/** The wizard's first proposal for a picture (spec 0645): By Pixel to bead ratio for a small picture, By size for a
 * larger one, at the preset giving the most beads up to 150 on the long side, else 1:1. */
export function startingProposal(image: ImageSize): { mode: SizeMode; ratio: PixelToBeadRatio } {
  const long = Math.max(image.width, image.height)
  const fitting = RATIO_PRESETS.find((ratio) => Math.ceil(long / pixelsPerBead(ratio)) <= STARTING_MAX_BEADS)
  return { mode: long < SMALL_PICTURE_PX ? 'ratio' : 'size', ratio: fitting ?? { pixels: 1, beads: 1 } }
}

/** The starting size By size: the starting ratio's Schema, or the picture's shape at 150 beads on its long side. */
export function startingSize(image: ImageSize, bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>, technique: Technique): GridDimensions {
  const grid = ratioGrid(fullCrop(image), startingProposal(image).ratio)
  if (Math.max(grid.columns, grid.rows) <= STARTING_MAX_BEADS) return grid
  return image.width >= image.height
    ? { columns: STARTING_MAX_BEADS, rows: proportionalSide(image, bead, technique, { columns: STARTING_MAX_BEADS }) }
    : { columns: proportionalSide(image, bead, technique, { rows: STARTING_MAX_BEADS }), rows: STARTING_MAX_BEADS }
}

/** Keep picture proportions (spec 0645): the other side, in whole beads, of a Frame with the picture's physical shape
 * through the Bead and the Technique's row spacing, from the side that was set. */
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

/** The ratio nearest a number of pixels per bead (spec 0645's mode switch): n:1 from one pixel per bead up, 1:n below,
 * each side at most CUSTOM_RATIO_MAX. */
export function nearestRatio(pixelsPerBeadValue: number): PixelToBeadRatio {
  if (pixelsPerBeadValue >= 1) return { pixels: clamp(Math.round(pixelsPerBeadValue), 1, CUSTOM_RATIO_MAX), beads: 1 }
  return { pixels: 1, beads: clamp(Math.round(1 / pixelsPerBeadValue), 1, CUSTOM_RATIO_MAX) }
}

/** What a size is as a ratio, picture pixels per bead along each side: the result line's "1 bead ≈ 4.3 × 3.5 px". */
export function ratioOfSize(crop: PixelCrop, grid: GridDimensions): { x: number; y: number } {
  return { x: crop.width / grid.columns, y: crop.height / grid.rows }
}

/** The part of the picture under the Frame By size, in picture pixels: what a switch to By Pixel to bead ratio crops to. */
export function cropForView(image: ImageSize, frame: FrameSizeMm, view: FramingView): PixelCrop {
  const width = Math.min(image.width, frame.widthMm / view.scaleMm)
  const height = Math.min(image.height, frame.heightMm / view.scaleMm)
  return {
    x: clamp(-view.offsetXMm / view.scaleMm, 0, image.width - width),
    y: clamp(-view.offsetYMm / view.scaleMm, 0, image.height - height),
    width,
    height,
  }
}

/** The zoom and pan that put a crop under the Frame By size, centred on it and still covering the Frame: what a switch
 * from By Pixel to bead ratio carries across. */
export function viewForCrop(image: ImageSize, frame: FrameSizeMm, crop: PixelCrop): { zoom: number; pan: PanFraction } {
  const zoom = clampConvertZoom(Math.max(frame.widthMm / crop.width, frame.heightMm / crop.height) / coverScaleMm(image, frame))
  const scaleMm = coverScaleMm(image, frame) * zoom
  const pan = (center: number, frameMm: number, length: number, fallback: number) => {
    const range = length * scaleMm - frameMm
    return range <= 1e-9 ? fallback : clamp((center * scaleMm - frameMm / 2) / range, 0, 1)
  }
  return {
    zoom,
    pan: {
      x: pan(crop.x + crop.width / 2, frame.widthMm, image.width, CENTERED_PAN.x),
      y: pan(crop.y + crop.height / 2, frame.heightMm, image.height, CENTERED_PAN.y),
    },
  }
}

/** Beads on a side beyond which converting and drawing take longer: the Large Schema note (spec 0645). The preview
 * draws at most PREVIEW_MAX_CELLS around the Frame, so the Frame itself is what grows. */
export const LARGE_SCHEMA_BEADS = 300

export function isLargeSchema({ columns, rows }: GridDimensions): boolean {
  return columns > LARGE_SCHEMA_BEADS || rows > LARGE_SCHEMA_BEADS
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

/** The words the result line is made of (PixelToBeadRatio card), in the app's language. */
export interface ResultLabels {
  /** "{columns}×{rows} beads" */
  grid: string
  /** "1 bead = {n} × {n} px" */
  exact: string
  /** "1 bead ≈ {x} × {y} px" */
  approximate: string
  /** "1 px = {n} × {n} beads" */
  perPixel: string
  mm: string
  cm: string
}

/** What a conversion makes, for the result line: its grid, through the Bead, and the ratio, given By Pixel to bead ratio
 * or read from the crop By size. */
export interface ResultInput {
  grid: GridDimensions
  bead: Bead
  ratio?: PixelToBeadRatio
  crop?: PixelCrop
}

/** The result line both Size modes share (spec 0645): "32×24 beads", "5.1 × 3.1 cm" and "1 bead = 8 × 8 px", with "≈"
 * when a size is not a whole ratio. */
export function convertResult({ grid, bead, ratio, crop }: ResultInput, labels: ResultLabels, locale: Locale = 'en'): { grid: string; measured: string; ratio: string } {
  const exactRatio = ratio ?? (crop && wholeRatio(ratioOfSize(crop, grid)))
  const decimal = decimalSign(locale)
  const oneDecimal = (value: number) => String(Number(value.toFixed(1))).replace('.', decimal)
  let ratioText = ''
  if (exactRatio) {
    ratioText = exactRatio.beads > 1 ? fillBlanks(labels.perPixel, { n: exactRatio.beads }) : fillBlanks(labels.exact, { n: exactRatio.pixels })
  } else if (crop) {
    const { x, y } = ratioOfSize(crop, grid)
    ratioText = fillBlanks(labels.approximate, { x: oneDecimal(x), y: oneDecimal(y) })
  }
  return {
    grid: fillBlanks(labels.grid, { columns: grid.columns, rows: grid.rows }),
    measured: formatSizeMm(estimatedSizeMm(grid, bead), labels, locale),
    ratio: ratioText,
  }
}

/** The ratio a size is when it is a whole one: the same whole number of pixels per bead each way. */
function wholeRatio({ x, y }: { x: number; y: number }): PixelToBeadRatio | undefined {
  const whole = Math.round(x)
  return whole >= 1 && Math.abs(x - whole) < 1e-9 && Math.abs(y - whole) < 1e-9 ? { pixels: whole, beads: 1 } : undefined
}
