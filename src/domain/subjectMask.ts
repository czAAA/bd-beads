import { colorDistance, toOklab, type Oklab } from './color'
import type { PixelCrop } from './convertSize'
import { NO_COLOR, pixelPackedAt, type PixelData } from './imageConversion'

/** Convert image's subject mask (ticket 0765, spec 0761): which of the picture's pixels are the subject that Cut out
 * keeps. The sampler reads a pixel outside it as transparent, so its beads are empty and its colors are never found.
 * Simple's mask is made here; any other source (the AI service, ticket 0767) only has to hand over the same shape. */

/** One byte per picture pixel, row by row: 1 where the subject is, 0 where Cut out takes the pixel away. It is the
 * picture's size and belongs to the picture as it is after any turn or flip. */
export interface SubjectMask {
  readonly width: number
  readonly height: number
  readonly subject: Uint8Array
}

/** Simple's Tolerance, in hundredths of an OKLab distance (ΔEOK): the slider's whole steps, its ends and where it starts.
 * 10 takes a photo's noise and soft shading round a plain field; 40 reaches well into colors that only look alike. */
export const MIN_TOLERANCE = 1
export const MAX_TOLERANCE = 40
export const DEFAULT_TOLERANCE = 10

/** How close two border colors must be, in OKLab, to be one background family (as beadAreaColor groups a bead's pixels). */
const FAMILY_DISTANCE = 0.07
/** The smallest share of the border a family must cover to be background: a subject touching the edge in a few pixels
 * does not make its own colors background. */
const MIN_FAMILY_SHARE = 0.02
/** At most this many background families; a border with more colors than this has no plain background to take. */
const MAX_FAMILIES = 16

/** Colors are judged at 6 bits a channel: a photo has too many colors to convert each, and the rounding (under 0.01 in
 * OKLab) is far finer than any Tolerance. */
const binOf = (packed: number) => (((packed >> 18) & 63) << 12) | (((packed >> 10) & 63) << 6) | ((packed >> 2) & 63)
const BINS = 64 * 64 * 64
const level = (step: number) => step * 4 + 2
const binOklab = (bin: number): Oklab => toOklab({ r: level((bin >> 12) & 63), g: level((bin >> 6) & 63), b: level(bin & 63) })

/** The colors covering the picture's border, as families (spec 0761, Simple): its background. Each family is the color
 * most of its border pixels have; a family covering under MIN_FAMILY_SHARE of the border is the subject touching it. */
export function backgroundFamilies(picture: PixelData): Oklab[] {
  const { width, height } = picture
  const counts = new Map<number, number>()
  let opaque = 0
  const count = (x: number, y: number) => {
    const packed = pixelPackedAt(picture, x, y)
    if (packed === NO_COLOR) return
    const bin = binOf(packed)
    counts.set(bin, (counts.get(bin) ?? 0) + 1)
    opaque += 1
  }
  for (let x = 0; x < width; x += 1) {
    count(x, 0)
    if (height > 1) count(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    count(0, y)
    if (width > 1) count(width - 1, y)
  }
  // The most common colors first, so each family is seeded by the color it has most of.
  const families: { color: Oklab; pixels: number }[] = []
  for (const [bin, pixels] of [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    const color = binOklab(bin)
    const near = families.find((family) => colorDistance(family.color, color) < FAMILY_DISTANCE)
    if (near) near.pixels += pixels
    else families.push({ color, pixels })
  }
  return families
    .filter((family) => family.pixels >= opaque * MIN_FAMILY_SHARE)
    .sort((a, b) => b.pixels - a.pixels)
    .slice(0, MAX_FAMILIES)
    .map((family) => family.color)
}

/** Simple's mask (spec 0761): a fill from every border pixel spreads to its four neighbours while they are within
 * Tolerance of a background family (see backgroundFamilies), and through transparent pixels; what it reaches is not
 * the subject. Tolerance is in hundredths of OKLab (MIN_TOLERANCE to MAX_TOLERANCE). */
export function simpleCutOut(picture: PixelData, families: readonly Oklab[], tolerance: number): SubjectMask {
  const { width, height, data } = picture
  const total = width * height
  const reach = tolerance / 100
  // A pixel's packed color, or NO_COLOR; read straight from an opaque pixel, as nearly all are, for a 16 MP picture.
  const colorAt = (index: number) => {
    const at = index * 4
    if (data[at + 3] === 255) return ((data[at] ?? 0) << 16) | ((data[at + 1] ?? 0) << 8) | (data[at + 2] ?? 0)
    return pixelPackedAt(picture, index % width, (index / width) | 0)
  }
  // Whether a color bin is background: -1 not yet judged, 0 no, 1 yes.
  const judged = new Int8Array(BINS).fill(-1)
  const isBackground = (packed: number) => {
    const bin = binOf(packed)
    let known = judged[bin]!
    if (known < 0) {
      const color = binOklab(bin)
      known = families.some((family) => colorDistance(family, color) <= reach) ? 1 : 0
      judged[bin] = known
    }
    return known === 1
  }
  // 0 not looked at, 1 reached by the fill, 2 looked at and kept (a color the fill stops at).
  const state = new Uint8Array(total)
  let queue = new Int32Array(Math.min(total, 1 << 16))
  let head = 0
  let size = 0
  const visit = (index: number) => {
    if (state[index] !== 0) return
    const packed = colorAt(index)
    if (packed !== NO_COLOR && !isBackground(packed)) {
      state[index] = 2
      return
    }
    state[index] = 1
    if (size === queue.length) {
      // The ring is full: unroll it into one twice as long.
      const grown = new Int32Array(queue.length * 2)
      grown.set(queue.subarray(head))
      grown.set(queue.subarray(0, head), queue.length - head)
      queue = grown
      head = 0
    }
    queue[(head + size) % queue.length] = index
    size += 1
  }
  for (let x = 0; x < width; x += 1) {
    visit(x)
    visit((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    visit(y * width)
    visit(y * width + width - 1)
  }
  while (size > 0) {
    const index = queue[head]!
    head = (head + 1) % queue.length
    size -= 1
    const x = index % width
    if (x > 0) visit(index - 1)
    if (x < width - 1) visit(index + 1)
    if (index >= width) visit(index - width)
    if (index < total - width) visit(index + width)
  }
  const subject = new Uint8Array(total)
  for (let index = 0; index < total; index += 1) {
    if (state[index] === 2 || (state[index] === 0 && colorAt(index) !== NO_COLOR)) subject[index] = 1
  }
  return { width, height, subject }
}

/** The smallest box of whole pixels round every subject pixel (Fit to subject, ticket 0765); none when the mask keeps
 * nothing. */
export function subjectBox(mask: SubjectMask): PixelCrop | undefined {
  const { width, height, subject } = mask
  let left = width
  let right = -1
  let top = height
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      if (!subject[row + x]) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      bottom = y
    }
  }
  return right < 0 ? undefined : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}
