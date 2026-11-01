import type { PixelData } from './imageConversion'
import type { SubjectMask } from './subjectMask'

/** Cut out with AI (ticket 0767, spec 0761, ADR 0087): what the wizard asks of the cut-out service, and the pure work on
 * each side of the model, IS-Net general-use: the picture stretched to its square going in, its answer scaled back to
 * the picture and thresholded into the subject mask coming out. The model itself runs in the service's worker. */

/** A download's size in whole MB, as the download note and the AI Loading say it (writing.md, Numbers and units):
 * rounded, never 0 for a total; rounded down for the part done, so it reaches the total only when it is done. */
export const megabytes = (bytes: number, done = false) => (done ? Math.floor(bytes / 1_000_000) : Math.max(1, Math.round(bytes / 1_000_000)))

/** What the service says while it works: the bytes downloaded of those it needs, then the model at work. */
export type CutOutProgress = { kind: 'downloading'; done: number; total: number } | { kind: 'thinking' }

/** How a run ended: the subject's mask, stopped by `cancel()`, or failed with the reason (for the console, not the screen). */
export type CutOutOutcome = { kind: 'done'; mask: SubjectMask } | { kind: 'cancelled' } | { kind: 'failed'; reason: string }

/** A tap on the preview while tap add or tap remove is on (ticket 0769): the picture pixel tapped and what it does to the
 * region under it. */
export interface CutOutTap {
  readonly x: number
  readonly y: number
  readonly kind: 'add' | 'remove'
}

/** The two models: the one that finds the subject (IS-Net) and the one that finds a tapped region (SlimSAM, ticket 0769),
 * downloaded on the first tap only. */
export type CutOutModelName = 'subject' | 'taps'

/** The cut-out service (spec 0761), handed to the Convert image wizard among its dependencies as `decodeImage` is. It
 * owns the worker, the runtime and model files and their cache; a test hands the wizard a fake one. One run at a time. */
export interface CutOutService {
  /** The bytes still to download before that model can run without the network: 0 once its files are on the device. */
  toDownload(model: CutOutModelName): Promise<number>
  /** Finds the picture's subject, downloading what is missing first, telling its progress as it goes. */
  subject(picture: PixelData, onProgress: (progress: CutOutProgress) => void): Promise<CutOutOutcome>
  /** The `automatic` mask `subject` found, with each tap's region joined (add) or taken away (remove), in order
   * (ticket 0769); the tap model is downloaded first when it is missing. */
  refine(picture: PixelData, automatic: SubjectMask, taps: readonly CutOutTap[], onProgress: (progress: CutOutProgress) => void): Promise<CutOutOutcome>
  /** Stops the download or run in hand at once; its `subject` ends `cancelled`. Nothing in hand: nothing happens. */
  cancel(): void
}

/** What the device record keeps (ticket 0768, ADR 0087: the device is judged by what happened, not guessed). */
export interface CutOutRecord {
  /** Set while a model is at work, cleared after: still set when the converter next opens, the tab was closed mid-run. */
  readonly running: boolean
  /** The last run stopped with the tab: the AI chip warns until a run finishes. */
  readonly stopped: boolean
  /** How long the first finished run's model thought, in ms; none until one has. */
  readonly firstRunMs?: number
}

/** The device beside the cut-out service (ticket 0768), handed to the wizard with it so a test can give it a fake: the
 * record kept on the device, and the cheap checks before a first download. None of them ever blocks the AI choice. */
export interface CutOutDevice {
  read(): CutOutRecord
  write(record: CutOutRecord): void
  /** The memory the browser reports, in GB; none where it says nothing (Safari, Firefox). */
  memoryGb(): number | undefined
  /** The bytes the browser estimates the app may still store; none where it can't say. */
  freeBytes(): Promise<number | undefined>
}

/** Under this much reported memory, the download note says the device may be slow (spec 0761). */
export const LOW_MEMORY_GB = 4

/** Linear interpolation's two neighbours and the far one's weight, for a target index scaled from `to` cells onto `from`
 * (half-pixel centres, as the upstream model's resize). */
export function neighbours(index: number, from: number, to: number): [number, number, number] {
  const at = Math.min(from - 1, Math.max(0, ((index + 0.5) * from) / to - 0.5))
  const low = Math.floor(at)
  return [low, Math.min(from - 1, low + 1), at - low]
}

/** The model's input: the picture stretched (bilinear) to `side` × `side` (IS-Net general-use reads 1024), each channel
 * its own plane, each value value / 255 - 0.5 (IS-Net's normalization: mean 0.5, deviation 1). */
export function subjectModelInput(picture: PixelData, side: number): Float32Array {
  const { width, height, data } = picture
  const plane = side * side
  const input = new Float32Array(3 * plane)
  const columns = Array.from({ length: side }, (_, x) => neighbours(x, width, side))
  for (let y = 0; y < side; y += 1) {
    const [top, bottom, down] = neighbours(y, height, side)
    for (let x = 0; x < side; x += 1) {
      const [left, right, across] = columns[x]!
      const a = (top * width + left) * 4
      const b = (top * width + right) * 4
      const c = (bottom * width + left) * 4
      const d = (bottom * width + right) * 4
      const at = y * side + x
      for (let channel = 0; channel < 3; channel += 1) {
        const upper = data[a + channel]! + (data[b + channel]! - data[a + channel]!) * across
        const lower = data[c + channel]! + (data[d + channel]! - data[c + channel]!) * across
        input[channel * plane + at] = (upper + (lower - upper) * down) / 255 - 0.5
      }
    }
  }
  return input
}

/** The subject mask from the model's `side` × `side` answer: scaled back (bilinear) to the picture's `width` × `height`
 * and kept where it is at least halfway between the answer's lowest and highest values, as upstream scales it. A flat
 * answer tells no subject apart, so the whole picture is kept. */
export function maskFromModel(output: Float32Array, side: number, width: number, height: number): SubjectMask {
  let low = Infinity
  let high = -Infinity
  for (const value of output) {
    if (value < low) low = value
    if (value > high) high = value
  }
  const subject = new Uint8Array(width * height)
  if (!(high > low)) return { width, height, subject: subject.fill(1) }
  const middle = (low + high) / 2
  const columns = Array.from({ length: width }, (_, x) => neighbours(x, side, width))
  for (let y = 0; y < height; y += 1) {
    const [top, bottom, down] = neighbours(y, side, height)
    for (let x = 0; x < width; x += 1) {
      const [left, right, across] = columns[x]!
      const upper = output[top * side + left]! + (output[top * side + right]! - output[top * side + left]!) * across
      const lower = output[bottom * side + left]! + (output[bottom * side + right]! - output[bottom * side + left]!) * across
      if (upper + (lower - upper) * down >= middle) subject[y * width + x] = 1
    }
  }
  return { width, height, subject }
}
