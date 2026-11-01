import { neighbours, type CutOutTap } from './cutOutModel'
import type { PixelData } from './imageConversion'
import type { SubjectMask } from './subjectMask'

/** Cut out's taps (ticket 0769, spec 0761, ADR 0087): the pure work on each side of the tap model, SlimSAM-77. Its
 * encoder reads the picture once, scaled so its longer side fills a square and padded; its decoder answers each tapped
 * point with a region, a coarser square of scores the picture's pixels are read back from. The model runs in the worker. */

/** The side of the square the tap model reads the picture at. */
const TAP_MODEL_SIDE = 1024
/** The side of the square of scores the tap model answers a point with, over the whole read square. */
export const TAP_MASK_SIDE = 256

/** SAM's normalization (ImageNet's): each channel's mean and deviation over values 0 to 1. */
const MEAN = [0.485, 0.456, 0.406]
const DEVIATION = [0.229, 0.224, 0.225]

/** The model's input: the picture scaled (bilinear) so its longer side is `side`, at the square's top left, each channel
 * its own plane, each value normalized; the rest of the square 0. */
export function tapModelInput(picture: PixelData, side = TAP_MODEL_SIDE): Float32Array {
  const { width, height, data } = picture
  const scale = side / Math.max(width, height)
  const across = Math.max(1, Math.round(width * scale))
  const down = Math.max(1, Math.round(height * scale))
  const plane = side * side
  const input = new Float32Array(3 * plane)
  const columns = Array.from({ length: across }, (_, x) => neighbours(x, width, across))
  for (let y = 0; y < down; y += 1) {
    const [top, bottom, below] = neighbours(y, height, down)
    for (let x = 0; x < across; x += 1) {
      const [left, right, beside] = columns[x]!
      const a = (top * width + left) * 4
      const b = (top * width + right) * 4
      const c = (bottom * width + left) * 4
      const d = (bottom * width + right) * 4
      for (let channel = 0; channel < 3; channel += 1) {
        const upper = data[a + channel]! + (data[b + channel]! - data[a + channel]!) * beside
        const lower = data[c + channel]! + (data[d + channel]! - data[c + channel]!) * beside
        const value = (upper + (lower - upper) * below) / 255
        input[channel * plane + y * side + x] = (value - MEAN[channel]!) / DEVIATION[channel]!
      }
    }
  }
  return input
}

/** A tap's point as the model takes it: the tapped pixel's centre, in the read square's scale. */
export function tapModelPoint(at: { x: number; y: number }, width: number, height: number, side = TAP_MODEL_SIDE): [number, number] {
  const scale = side / Math.max(width, height)
  return [(at.x + 0.5) * scale, (at.y + 0.5) * scale]
}

/** The tapped region over the picture's `width` × `height` pixels, from the model's `TAP_MASK_SIDE` square of scores:
 * each pixel's centre found on it (bilinear) and kept where the score is above 0, as upstream thresholds it. The picture's
 * longer side spans the whole square, as it was read. */
export function regionFromTapModel(scores: Float32Array, width: number, height: number): SubjectMask {
  const longer = Math.max(width, height)
  const at = (index: number) => neighbours(index, TAP_MASK_SIDE, longer)
  const columns = Array.from({ length: width }, (_, x) => at(x))
  const subject = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const [top, bottom, below] = at(y)
    for (let x = 0; x < width; x += 1) {
      const [left, right, beside] = columns[x]!
      const score = (row: number) => scores[row * TAP_MASK_SIDE + left]! + (scores[row * TAP_MASK_SIDE + right]! - scores[row * TAP_MASK_SIDE + left]!) * beside
      const upper = score(top)
      if (upper + (score(bottom) - upper) * below > 0) subject[y * width + x] = 1
    }
  }
  return { width, height, subject }
}

/** The AI choice's mask after taps (spec 0761): the automatic one with each add tap's region joined and each remove
 * tap's region taken away, in the order tapped, so a later tap wins where two overlap. */
export function refinedMask(automatic: SubjectMask, regions: readonly { kind: CutOutTap['kind']; region: SubjectMask }[]): SubjectMask {
  const subject = Uint8Array.from(automatic.subject)
  for (const { kind, region } of regions) {
    const value = kind === 'add' ? 1 : 0
    region.subject.forEach((inside, index) => {
      if (inside) subject[index] = value
    })
  }
  return { width: automatic.width, height: automatic.height, subject }
}
