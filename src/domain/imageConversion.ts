import type { Bead } from './beads'
import { toHex, type Rgb } from './color'
import { fillBlanks } from './fillBlanks'
import { type GridDimensions } from './grid'
import { describeWeave, type Technique, type TechniqueSettings } from './weave'
import { pixelsPerBead, type PixelCrop, type PixelToBeadRatio } from './convertSize'
import {
  type FramingView,
  type ImageSize,
  type PreviewLattice,
} from './imageFraming'

/** Convert image's conversion (ticket 58, ADR 0010): pixels to cells, and what a picture may be. Pure functions over
 * a decoded picture; file reading and decoding live in imageDecode.ts so tests can use hand-built pixel data. */

/** A decoded picture: RGBA, four bytes per pixel, row by row. Its own interface, not `ImageData` (browser-only), so
 * tests can build one; a real `ImageData` satisfies it. */
export interface PixelData extends ImageSize {
  data: ArrayLike<number>
}

/** A pixel this transparent or more leaves its cell unpainted: there is no half-bead, and 50% is the only
 * non-arbitrary line. A transparent-background icon converts to a shape, not a rectangle. */
const ALPHA_THRESHOLD = 128

/** What a packed color holds for a pixel that is too transparent to weave, or a cell that falls off the picture. */
export const NO_COLOR = -1

/** A pixel's color as one number 0xRRGGBB, or NO_COLOR below half alpha (see ALPHA_THRESHOLD); partly transparent
 * pixels composite over white. A number, not a string, since a drag samples tens of thousands per move.
 * @internal Its test checks a pixel's color on its own. */
export function pixelPackedAt(image: PixelData, x: number, y: number): number {
  const at = (y * image.width + x) * 4
  const alpha = image.data[at + 3] ?? 0
  if (alpha < ALPHA_THRESHOLD) {
    return NO_COLOR
  }

  const over = alpha / 255
  const onWhite = (channel: number) => Math.round(channel * over + 255 * (1 - over))

  return (
    (onWhite(image.data[at] ?? 0) << 16) | (onWhite(image.data[at + 1] ?? 0) << 8) | onWhite(image.data[at + 2] ?? 0)
  )
}

/** A packed color (see pixelPackedAt) as the `#rrggbb` a grid cell stores. */
export function packedToHex(packed: number): string {
  return toHex(unpacked(packed))
}

/** A packed color (see pixelPackedAt) as its channels. */
export function unpacked(packed: number): Rgb {
  return { r: (packed >> 16) & 0xff, g: (packed >> 8) & 0xff, b: packed & 0xff }
}

/** A picture format Convert image accepts, named the way the file input, the validation and the helper text each
 * need it. */
interface ImageFormat {
  mimeType: string
  /** A brand name, so it reads the same in every language. */
  label: string
  extensions: readonly string[]
}

/** The accepted formats, in one place: file input `accept`, media-type check, extension fallback and helper text
 * all read this, so the UI's promise and the validation cannot drift apart.
 * @internal Its test checks every format against the file checks. */
export const ACCEPTED_IMAGE_FORMATS: readonly ImageFormat[] = [
  { mimeType: 'image/png', label: 'PNG', extensions: ['.png'] },
  { mimeType: 'image/jpeg', label: 'JPEG', extensions: ['.jpg', '.jpeg'] },
  { mimeType: 'image/gif', label: 'GIF', extensions: ['.gif'] },
  { mimeType: 'image/webp', label: 'WebP', extensions: ['.webp'] },
]

/** @internal Tests try a file just over the cap. */
export const IMAGE_MAX_MEGABYTES = 10
/** @internal Tests try a file just over the cap. */
export const IMAGE_MAX_BYTES = IMAGE_MAX_MEGABYTES * 1024 * 1024
/** @internal Tests try a picture just over the cap. */
export const IMAGE_MAX_MEGAPIXELS = 16
/** @internal Tests try a picture just over the cap. */
export const IMAGE_MAX_PIXELS = IMAGE_MAX_MEGAPIXELS * 1_000_000

/** HEIC/HEIF (iPhone photos) gets its own rejection message: browsers can't decode it. Matched on extension too,
 * because a phone often supplies no media type. */
const HEIC_FORMAT: ImageFormat = {
  mimeType: 'image/heic',
  label: 'HEIC',
  extensions: ['.heic', '.heif'],
}
const HEIC_MIME_TYPES = ['image/heic', 'image/heif']

/** SVG, turned away on purpose (ticket 58): no native resolution to sample, and rendering arbitrary markup from a
 * file is a security surface this feature doesn't need. */
const SVG_FORMAT: ImageFormat = { mimeType: 'image/svg+xml', label: 'SVG', extensions: ['.svg'] }

/** Why a picture can't be converted. Each has its own localised message (see i18n's convertImage.errors). */
export type ImageRejection =
  | 'heic'
  | 'svg'
  | 'unsupportedFormat'
  | 'tooLarge'
  | 'tooManyPixels'
  | 'decodeFailed'

/** What a file input hands over, and all the file-level validation needs of it. */
export interface ImageFileFacts {
  name: string
  type: string
  size: number
}

function hasExtension(name: string, format: ImageFormat): boolean {
  const lower = name.toLowerCase()
  return format.extensions.some((extension) => lower.endsWith(extension))
}

function isFormat(file: ImageFileFacts, format: ImageFormat, mimeTypes = [format.mimeType]): boolean {
  return mimeTypes.includes(file.type.toLowerCase()) || (file.type === '' && hasExtension(file.name, format))
}

/** The `accept` attribute for the file input: the media types plus their extensions, for pickers that filter by
 * either. */
export function imageInputAccept(): string {
  return ACCEPTED_IMAGE_FORMATS.flatMap((format) => [format.mimeType, ...format.extensions]).join(',')
}

/** Fills `{formats}`, `{maxSizeMb}` and `{maxMegapixels}` into a localised sentence, so the numbers the UI promises
 * are the constants the validation enforces (ticket 58's "cannot drift apart"). A sentence holds the ones it needs. */
export function formatImageLimits(template: string): string {
  return fillBlanks(template, {}, {
    formats: ACCEPTED_IMAGE_FORMATS.map((format) => format.label).join(', '),
    maxSizeMb: IMAGE_MAX_MEGABYTES,
    maxMegapixels: IMAGE_MAX_MEGAPIXELS,
  })
}

/** Whether a chosen file can be converted, judged before decoding: format and size. The resolution limit needs
 * decoded dimensions instead (validateImagePixelCount). */
export function validateImageFile(file: ImageFileFacts): ImageRejection | undefined {
  if (isFormat(file, HEIC_FORMAT, HEIC_MIME_TYPES)) {
    return 'heic'
  }
  if (isFormat(file, SVG_FORMAT)) {
    return 'svg'
  }
  if (!ACCEPTED_IMAGE_FORMATS.some((format) => isFormat(file, format))) {
    return 'unsupportedFormat'
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return 'tooLarge'
  }
  return undefined
}

/** Whether a decoded picture is within the resolution limit (see IMAGE_MAX_PIXELS). */
export function validateImagePixelCount({ width, height }: ImageSize): ImageRejection | undefined {
  return width * height > IMAGE_MAX_PIXELS ? 'tooManyPixels' : undefined
}

/** How many colors a conversion may keep. Ceiling 14. Floor 1, down from 2 (ticket 177, ADR 0010):
 * quantization is unconditional. */
export const MIN_IMAGE_COLORS = 1
export const MAX_IMAGE_COLORS = 14
export const DEFAULT_MAX_IMAGE_COLORS = 12

export function clampMaxImageColors(value: number): number {
  return Math.min(MAX_IMAGE_COLORS, Math.max(MIN_IMAGE_COLORS, Math.floor(value)))
}

/** Where the picture sits under the Frame By size (ticket 58): its view in the Frame's millimetres, through the Bead. */
interface SizePlacement {
  view: FramingView
  bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>
}

/** Where the picture sits under the Frame By Pixel to bead ratio (spec 0645): the crop, each bead one block of it. */
interface RatioPlacement {
  crop: PixelCrop
  ratio: PixelToBeadRatio
}

/** What the picture, its placement and the Technique's geometry are, for one pass of sampling. */
type SamplingInput = {
  image: PixelData
  technique: Technique
  /** The settings of the Project being made (ticket 0625): its Drop; one left out is its default. */
  techniqueSettings?: TechniqueSettings
} & (SizePlacement | RatioPlacement)

/** A placement as cell sizes and the step from a bead centre to a picture pixel: pixel = (centre − corner − offset) /
 * scale. By ratio the cells are in pixels, a bead step one block; by size in millimetres. */
function samplingGrid(input: SamplingInput) {
  if ('view' in input) {
    const { widthMm, heightMm } = describeWeave(input).beadMm(input.bead)
    return { cellWidth: widthMm, cellHeight: heightMm, offsetX: input.view.offsetXMm, offsetY: input.view.offsetYMm, scale: input.view.scaleMm, slack: 0 }
  }
  const per = pixelsPerBead(input.ratio)
  // A staggered line's last bead reaches half a bead past the crop: one block of slack keeps it on the picture.
  return { cellWidth: per, cellHeight: per, offsetX: -input.crop.x, offsetY: -input.crop.y, scale: 1, slack: Math.max(1, per) }
}

/** The picture's raw colors at the centre of each bead of a framing preview's lattice (see previewLattice), row by row,
 * packed (see pixelPackedAt); NO_COLOR off the picture or on a too-transparent pixel. The Weave's description places
 * each bead (ticket 0622), By size or By Pixel to bead ratio (spec 0645). */
export function sampleLatticePacked(input: SamplingInput & { lattice: PreviewLattice }): Int32Array {
  const { image, lattice } = input
  const { cellWidth, cellHeight, offsetX, offsetY, scale, slack } = samplingGrid(input)
  const description = describeWeave(input)
  // The frame's corner: its first row is never shifted.
  const { x: originX, y: originY } = description.origin({ row: lattice.frameRow, column: lattice.frameColumn }, cellWidth, cellHeight)
  const packed = new Int32Array(lattice.rows * lattice.columns).fill(NO_COLOR)
  const onPicture = (at: number, length: number) => (at >= length && at < length + slack ? length - 1 : at)
  for (let row = 0; row < lattice.rows; row += 1) {
    for (let column = 0; column < lattice.columns; column += 1) {
      const { x, y } = description.center({ row, column }, cellWidth, cellHeight)
      const sourceX = onPicture(Math.floor((x - originX - offsetX) / scale), image.width)
      const sourceY = onPicture(Math.floor((y - originY - offsetY) / scale), image.height)
      if (sourceX >= 0 && sourceX < image.width && sourceY >= 0 && sourceY < image.height) {
        packed[row * lattice.columns + column] = pixelPackedAt(image, sourceX, sourceY)
      }
    }
  }
  return packed
}

/** The Frame's own sampled colors from a lattice (see sampleLatticePacked), as `#rrggbb` (undefined for no bead), and
 * how many beads each covers: only the frame's cells take part, so panning never changes the colors found in it. */
export function frameColors(
  sampled: Int32Array,
  lattice: PreviewLattice,
  dimensions: GridDimensions,
): { raw: (string | undefined)[][]; counts: Map<string, number> } {
  const hexes = new Map<number, string>()
  const counts = new Map<string, number>()
  const raw = Array.from({ length: dimensions.rows }, (_row, row) =>
    Array.from({ length: dimensions.columns }, (_cell, column) => {
      const color = sampled[(row + lattice.frameRow) * lattice.columns + column + lattice.frameColumn]!
      if (color === NO_COLOR) {
        return undefined
      }
      let hex = hexes.get(color)
      if (hex === undefined) {
        hex = packedToHex(color)
        hexes.set(color, hex)
      }
      counts.set(hex, (counts.get(hex) ?? 0) + 1)
      return hex
    }),
  )
  return { raw, counts }
}

/** How a picture is turned into pixels. The real one is services/imageDecode's decodeImageFile; a test supplies its
 * own. */
export type DecodeImage = (file: Blob) => Promise<PixelData>

/** A file that can't be converted, carrying which of the localised reasons to show (see ImageRejection). */
export class ImageConversionError extends Error {
  readonly reason: ImageRejection

  constructor(reason: ImageRejection) {
    super(`Image cannot be converted: ${reason}`)
    this.name = 'ImageConversionError'
    this.reason = reason
  }
}
