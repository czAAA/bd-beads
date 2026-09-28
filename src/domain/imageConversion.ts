import { beadPitchMm, type Bead } from './beads'
import { rowHeightPx, rowOffsetPx, type GridDimensions, type Technique } from './grid'
import { nearestColor, resolveImageColors } from './imageColors'
import {
  type FramingView,
  type ImageSize,
  type PreviewLattice,
} from './imageFraming'
import type { Cell, Grid } from './pattern'

/**
 * Convert image's actual conversion (ticket 58, ADR 0010): what the picture's pixels become, cell by cell, and what a
 * picture is allowed to be in the first place.
 *
 * Everything here is a pure function over an already-decoded picture. Reading a file and decoding PNG/JPEG/GIF/WebP
 * bytes is the browser's job and lives apart, in imageDecode.ts, so the conversion itself can be exercised on pixel
 * data built by hand.
 */

/**
 * A decoded picture: RGBA, four bytes per pixel, row by row. Deliberately its own interface rather than `ImageData`,
 * which only a browser can construct — a `{ width, height, data }` object is buildable in a test, and a real
 * `ImageData` satisfies this shape as it stands.
 */
export interface PixelData extends ImageSize {
  data: ArrayLike<number>
}

/**
 * A pixel this transparent or more leaves its cell unpainted: there is no half-bead, so a pixel is either woven or it
 * is not, and 50% is the only non-arbitrary place to put that line. A transparent-background icon therefore converts
 * to a shape rather than to a rectangle with a background.
 */
export const ALPHA_THRESHOLD = 128

/** What a packed color holds for a pixel that is too transparent to weave, or a cell that falls off the picture. */
export const NO_COLOR = -1

/**
 * The color a picture's pixel contributes to a cell as one number, 0xRRGGBB, or NO_COLOR for a pixel below half alpha
 * (an empty cell — see ALPHA_THRESHOLD). A partly transparent pixel at or above the line is composited over white, the
 * paper it would be seen against.
 *
 * The same color as pixelColorAt, without making a string of it: sampling a whole framing lattice on every move of a
 * drag is tens of thousands of these, and the preview only ever needs the string for the few distinct colors it holds.
 */
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
  return `#${packed.toString(16).padStart(6, '0')}`
}

/**
 * The color a picture's pixel contributes to a cell, or undefined for a pixel below half alpha (an empty cell — see
 * ALPHA_THRESHOLD).
 */
export function pixelColorAt(image: PixelData, x: number, y: number): string | undefined {
  const packed = pixelPackedAt(image, x, y)
  return packed === NO_COLOR ? undefined : packedToHex(packed)
}

/** A picture format Convert image accepts, named the way the file input, the validation and the helper text each need it. */
export interface ImageFormat {
  mimeType: string
  /** A brand name, so it reads the same in every language. */
  label: string
  extensions: readonly string[]
}

/**
 * The accepted formats, in one place. The file input's `accept`, the media-type check, the extension fallback for a
 * browser that reports no media type, and the advertised helper text all read this, so what the UI promises and what
 * the validation enforces cannot drift apart.
 */
export const ACCEPTED_IMAGE_FORMATS: readonly ImageFormat[] = [
  { mimeType: 'image/png', label: 'PNG', extensions: ['.png'] },
  { mimeType: 'image/jpeg', label: 'JPEG', extensions: ['.jpg', '.jpeg'] },
  { mimeType: 'image/gif', label: 'GIF', extensions: ['.gif'] },
  { mimeType: 'image/webp', label: 'WebP', extensions: ['.webp'] },
]

export const IMAGE_MAX_MEGABYTES = 10
export const IMAGE_MAX_BYTES = IMAGE_MAX_MEGABYTES * 1024 * 1024
export const IMAGE_MAX_MEGAPIXELS = 16
export const IMAGE_MAX_PIXELS = IMAGE_MAX_MEGAPIXELS * 1_000_000

/**
 * HEIC/HEIF, the format an iPhone photo arrives in, turned away with a message of its own rather than as a nameless
 * unsupported file — browsers can't decode it, and being told "use PNG or JPEG" is the only useful answer. Matched on
 * the extension as well as the media type, because a phone often hands over no media type at all for one.
 */
const HEIC_FORMAT: ImageFormat = {
  mimeType: 'image/heic',
  label: 'HEIC',
  extensions: ['.heic', '.heif'],
}
const HEIC_MIME_TYPES = ['image/heic', 'image/heif']

/**
 * SVG, turned away on purpose (ticket 58 decision): it has no native resolution to sample, so there is nothing to
 * decide the conversion's fidelity, and rendering arbitrary markup from a file is a security surface this feature
 * has no need of.
 */
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

/** The `accept` attribute for the file input: the media types plus their extensions, for pickers that filter by either. */
export function imageInputAccept(): string {
  return ACCEPTED_IMAGE_FORMATS.flatMap((format) => [format.mimeType, ...format.extensions]).join(',')
}

/**
 * Fills the advertised limits into a localised sentence: `{formats}`, `{maxSizeMb}` and `{maxMegapixels}`. The helper
 * text under the file input and its `title` both go through here, so the numbers the UI promises are literally the
 * constants the validation enforces (ticket 58's "cannot drift apart" requirement).
 */
export function formatImageLimits(template: string): string {
  return template
    .replace('{formats}', ACCEPTED_IMAGE_FORMATS.map((format) => format.label).join(', '))
    .replace('{maxSizeMb}', String(IMAGE_MAX_MEGABYTES))
    .replace('{maxMegapixels}', String(IMAGE_MAX_MEGAPIXELS))
}

/**
 * Whether a chosen file can be converted at all, judged on what a file input can tell us before anything is decoded:
 * its format and its size. The resolution limit needs the decoded pixel dimensions instead — see
 * validateImagePixelCount.
 */
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

/**
 * How many colors a conversion may keep. The default aims at the flat artwork this feature targets, where the honest
 * count is usually in single figures anyway and the limit never bites; a photograph is where the user reaches for the
 * control, and where any number is a compromise.
 *
 * The ceiling is 14 because Image colors are shown as swatches in the Colors group, and a Tool group holds at most 14
 * controls in view — two rows of seven (CONTEXT.md's Tool group). A higher ceiling would let one conversion fill that
 * group past what the layout is built for, and a Pattern needing more than fourteen colors is not one this feature is
 * for: it is the photograph case the ticket deliberately declines to build machinery for.
 *
 * The floor is 1, down from 2 (ticket 177, amending ADR 0011): now that every resolved color is quantized onto the
 * Palette regardless of count, reducing all the way to a single Palette-matched silhouette color is no less
 * meaningful a result than reducing to two -- there was nothing special about 2 once quantization is unconditional.
 */
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
  bead: Pick<Bead, 'widthMm' | 'heightMm' | 'widthCorrectionMm'>
}

/**
 * The picture's raw colors for every cell of a framing preview's lattice (see imageFraming's previewLattice), row by
 * row, as packed colors (see pixelPackedAt) — NO_COLOR where a cell falls off the picture, or on a pixel too
 * transparent to weave.
 *
 * Each cell is sampled at its true centre in millimetres (see grid.ts's cellCenter): `origin` is where the frame's own
 * cell (0, 0) sits in that lattice, so subtracting it puts the point back in the frame's own coordinates, which is what
 * the picture's position is measured in. The arithmetic is cellCenter's and sourcePixelAt's, in the same order, written
 * out over a whole row at a time because this runs on every move of a drag.
 */
export function sampleLatticePacked({
  image,
  view,
  technique,
  bead,
  lattice,
}: SamplingInput & { lattice: PreviewLattice }): Int32Array {
  const cellWidth = beadPitchMm(bead)
  const cellHeight = bead.heightMm

  /*
   * Where the frame's top-left corner sits in the lattice's own coordinates. A whole number of cells across and a
   * whole number of rows down, so a lattice cell's centre is its frame cell's centre plus exactly this — including the
   * half-cell stagger, which matches because frameRow is always even (see PreviewLattice.frameRow).
   */
  const originXMm = lattice.frameColumn * cellWidth
  const originYMm = lattice.frameRow * rowHeightPx(technique, cellHeight)

  const packed = new Int32Array(lattice.rows * lattice.columns)
  for (let row = 0; row < lattice.rows; row += 1) {
    const centerY = cellHeight / 2 + row * rowHeightPx(technique, cellHeight)
    const sourceY = Math.floor((centerY - originYMm - view.offsetYMm) / view.scaleMm)
    const rowStart = row * lattice.columns

    if (sourceY < 0 || sourceY >= image.height) {
      packed.fill(NO_COLOR, rowStart, rowStart + lattice.columns)
      continue
    }

    const stagger = rowOffsetPx(technique, row, cellWidth)
    for (let column = 0; column < lattice.columns; column += 1) {
      const centerX = column * cellWidth + cellWidth / 2 + stagger
      const sourceX = Math.floor((centerX - originXMm - view.offsetXMm) / view.scaleMm)
      packed[rowStart + column] =
        sourceX < 0 || sourceX >= image.width ? NO_COLOR : pixelPackedAt(image, sourceX, sourceY)
    }
  }

  return packed
}

/**
 * The same lattice as sampleLatticePacked, as `#rrggbb` strings — undefined where a cell falls off the picture, or on a
 * pixel too transparent to weave.
 *
 * The lattice's frame block is the Pattern's own cells, so the preview and the Pattern it will create come out of this
 * one sampling pass: what is inside the frame on screen is not a separate rendering of the same idea, it is the same
 * numbers (see convertSampledFrame).
 */
export function sampleLattice(
  input: SamplingInput & { lattice: PreviewLattice },
): (string | undefined)[][] {
  const { lattice } = input
  const packed = sampleLatticePacked(input)
  const hexes = new Map<number, string>()

  return Array.from({ length: lattice.rows }, (_row, row) =>
    Array.from({ length: lattice.columns }, (_cell, column) => {
      const color = packed[row * lattice.columns + column]!
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
  )
}

/** The Pattern a conversion produced: its grid, and the colors it found (frozen onto the Pattern — ADR 0011). */
export interface ConvertedImage {
  grid: Grid
  imageColors: string[]
}

/** Reduces the frame's raw colors (undefined for an empty cell) to at most `maxColors` and offers them to the Palette; see convertSampledFrame. */
function reduceFrame(raw: readonly (readonly (string | undefined)[])[], maxColors: number): ConvertedImage {
  const counts = new Map<string, number>()
  for (const row of raw) {
    for (const hex of row) {
      if (hex !== undefined) {
        counts.set(hex, (counts.get(hex) ?? 0) + 1)
      }
    }
  }

  const { mapping, colors } = resolveImageColors(counts, maxColors)
  const grid: Grid = raw.map((row) =>
    row.map<Cell>((hex) => ({ color: hex === undefined ? null : mapping.get(hex) ?? hex })),
  )

  return { grid, imageColors: colors }
}

/**
 * The Pattern's grid and Image colors, out of an already-sampled lattice: the frame's own block of cells, reduced to at
 * most `maxColors` colors and offered to the Palette for near-exact snapping (see resolveImageColors).
 *
 * Only the frame's cells take part. The preview's surrounding cells are context for judging the crop, and letting them
 * influence the reduction would mean the colors inside the frame changed as the picture was panned — the opposite of
 * "what is inside the frame is exactly the Pattern that will be created".
 */
export function convertSampledFrame(
  sampled: readonly (readonly (string | undefined)[])[],
  lattice: PreviewLattice,
  dimensions: GridDimensions,
  maxColors: number,
): ConvertedImage {
  return reduceFrame(
    Array.from({ length: dimensions.rows }, (_row, row) =>
      Array.from(
        { length: dimensions.columns },
        (_cell, column) => sampled[row + lattice.frameRow]?.[column + lattice.frameColumn],
      ),
    ),
    maxColors,
  )
}

/** convertSampledFrame for a lattice sampled into packed colors (see sampleLatticePacked): the same Pattern out of the same cells. */
export function convertPackedFrame(
  sampled: Int32Array,
  lattice: PreviewLattice,
  dimensions: GridDimensions,
  maxColors: number,
): ConvertedImage {
  const hexes = new Map<number, string>()

  return reduceFrame(
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

/**
 * One Convert image, straight from a picture and a framing view to the Pattern's grid and Image colors — the framing
 * preview reaches the same result through sampleLattice + convertSampledFrame, since the frame's cells are a block of
 * the lattice it already sampled.
 */
export function convertImage(
  input: SamplingInput & { dimensions: GridDimensions; maxColors: number },
): ConvertedImage {
  const lattice: PreviewLattice = {
    columns: input.dimensions.columns,
    rows: input.dimensions.rows,
    frameColumn: 0,
    frameRow: 0,
  }

  return convertSampledFrame(sampleLattice({ ...input, lattice }), lattice, input.dimensions, input.maxColors)
}

/**
 * The color a framing preview shows for a cell outside the frame: the nearest of the Image colors the conversion
 * settled on, so the whole preview reads as one bead picture rather than breaking into a quantized frame surrounded by
 * unquantized pixels. Undefined for a cell off the picture, or when the conversion found no colors at all.
 */
export function previewColorOutsideFrame(
  imageColors: readonly string[],
  hex: string | undefined,
): string | undefined {
  return hex === undefined ? undefined : nearestColor(imageColors, hex)
}
