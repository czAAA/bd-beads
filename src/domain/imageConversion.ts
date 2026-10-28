import { beadPitchMm, type Bead } from './beads'
import { fillBlanks } from './fillBlanks'
import { type GridDimensions } from './grid'
import { describeWeave, rowPitch, rowOffset, type Technique } from './weave'
import { resolveImageColors } from './imageColors'
import type { Palette } from './palette'
import {
  type FramingView,
  type ImageSize,
  type PreviewLattice,
} from './imageFraming'
import type { Cell, Grid } from './project'

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

/** A packed color (see pixelPackedAt) as the `#rrggbb` a grid cell stores.
 * @internal Tests write an expected color the way the preview reads it. */
export function packedToHex(packed: number): string {
  return `#${packed.toString(16).padStart(6, '0')}`
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

/** How many colors a conversion may keep. Ceiling 14. Floor 1, down from 2 (ticket 177, amending ADR 0011):
 * quantization is unconditional. */
export const MIN_IMAGE_COLORS = 1
export const MAX_IMAGE_COLORS = 14
export const DEFAULT_MAX_IMAGE_COLORS = 12

export function clampMaxImageColors(value: number): number {
  return Math.min(MAX_IMAGE_COLORS, Math.max(MIN_IMAGE_COLORS, Math.floor(value)))
}

/** What the picture, the frame and the Technique's geometry are, for one pass of sampling. */
interface SamplingInput {
  image: PixelData
  view: FramingView
  technique: Technique
  /** The Brick block of the Project being made (ticket 477); nothing is 1. */
  brickBlock?: number
  /** The Net size of the Project being made (ticket 485); nothing is the default. */
  netSize?: number
  bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>
}

/** The picture's raw colors for every cell of a framing preview's lattice (see previewLattice), row by row, packed
 * (see pixelPackedAt); NO_COLOR off the picture or on a too-transparent pixel. Inlines cellCenter and sourcePixelAt. */
export function sampleLatticePacked({
  image,
  view,
  technique,
  brickBlock,
  netSize,
  bead,
  lattice,
}: SamplingInput & { lattice: PreviewLattice }): Int32Array {
  const cellWidth = beadPitchMm(bead)
  const cellHeight = bead.heightMm
  const description = describeWeave({ technique, brickBlock, netSize })
  if (description.countsUnits) {
    return sampleUnitLattice({ image, view, description, cellWidth, cellHeight, lattice })
  }

  // Where the frame's top-left corner sits in the lattice's coordinates: whole cells and rows, so a lattice cell's
  // centre is its frame cell's centre plus exactly this, half-cell stagger included (frameRow is always even,
  // see PreviewLattice.frameRow).
  const originXMm = lattice.frameColumn * cellWidth
  const originYMm = lattice.frameRow * rowPitch(technique, cellHeight)

  const packed = new Int32Array(lattice.rows * lattice.columns)
  for (let row = 0; row < lattice.rows; row += 1) {
    const centerY = cellHeight / 2 + row * rowPitch(technique, cellHeight)
    const sourceY = Math.floor((centerY - originYMm - view.offsetYMm) / view.scaleMm)
    const rowStart = row * lattice.columns

    if (sourceY < 0 || sourceY >= image.height) {
      packed.fill(NO_COLOR, rowStart, rowStart + lattice.columns)
      continue
    }

    const stagger = rowOffset({ technique, brickBlock }, row, cellWidth)
    for (let column = 0; column < lattice.columns; column += 1) {
      const centerX = column * cellWidth + cellWidth / 2 + stagger
      const sourceX = Math.floor((centerX - originXMm - view.offsetXMm) / view.scaleMm)
      packed[rowStart + column] =
        sourceX < 0 || sourceX >= image.width ? NO_COLOR : pixelPackedAt(image, sourceX, sourceY)
    }
  }

  return packed
}

/** The Project a conversion produced: its grid, and the colors it found (frozen onto the Project — ADR 0011). */
export interface ConvertedImage {
  grid: Grid
  imageColors: string[]
}

/** Reduces the frame's raw colors (undefined for an empty cell) to at most `maxColors` and offers them to the
 * Palette; see convertPackedFrame. */
function reduceFrame(
  palette: Palette,
  raw: readonly (readonly (string | undefined)[])[],
  maxColors: number,
): ConvertedImage {
  const counts = new Map<string, number>()
  for (const row of raw) {
    for (const hex of row) {
      if (hex !== undefined) {
        counts.set(hex, (counts.get(hex) ?? 0) + 1)
      }
    }
  }

  const { mapping, colors } = resolveImageColors(palette, counts, maxColors)
  const grid: Grid = raw.map((row) =>
    row.map<Cell>((hex) => ({ color: hex === undefined ? null : mapping.get(hex) ?? hex })),
  )

  return { grid, imageColors: colors }
}

/** The picture's colors at the centre of each bead of a Units lattice (ticket 482): the lattice's top-left is the corner
 * of a Unit, and a position with no bead (a line's empty end) takes nothing. */
function sampleUnitLattice({ image, view, description, cellWidth, cellHeight, lattice }: {
  image: PixelData
  view: FramingView
  description: ReturnType<typeof describeWeave>
  cellWidth: number
  cellHeight: number
  lattice: PreviewLattice
}): Int32Array {
  // The frame's corner is its first Unit's: a line of vertical beads starts at the Unit's own edge.
  const { x: originX, y: originY } = description.origin({ row: lattice.frameRow, column: lattice.frameColumn }, cellWidth, cellHeight)
  const packed = new Int32Array(lattice.rows * lattice.columns).fill(NO_COLOR)
  for (let row = 0; row < lattice.rows; row += 1) {
    for (let column = 0; column < lattice.columns; column += 1) {
      if (!description.hasPosition({ row, column })) continue
      const { x, y } = description.center({ row, column }, cellWidth, cellHeight)
      const sourceX = Math.floor((x - originX - view.offsetXMm) / view.scaleMm)
      const sourceY = Math.floor((y - originY - view.offsetYMm) / view.scaleMm)
      if (sourceX >= 0 && sourceX < image.width && sourceY >= 0 && sourceY < image.height) {
        packed[row * lattice.columns + column] = pixelPackedAt(image, sourceX, sourceY)
      }
    }
  }
  return packed
}

/** The Project's grid and Image colors from an already-sampled lattice (see sampleLatticePacked): only the frame's
 * cells take part, so panning the picture never changes the colors inside the frame. */
export function convertPackedFrame(
  palette: Palette,
  sampled: Int32Array,
  lattice: PreviewLattice,
  dimensions: GridDimensions,
  maxColors: number,
): ConvertedImage {
  const hexes = new Map<number, string>()

  return reduceFrame(
    palette,
    Array.from({ length: dimensions.rows }, (_row, row) =>
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
        return hex
      }),
    ),
    maxColors,
  )
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
