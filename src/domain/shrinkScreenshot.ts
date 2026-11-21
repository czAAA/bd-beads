import type { ReportScreenshot } from './feedbackReport'

// Shrinking a picked picture to the Report's size cap (ticket 1180). Pure: the browser's decoding and encoding are
// passed in as `encode`, so the steps are tested with a fake one.

/** How far the picture is shrunk, in the order tried; the cap comes from `SCREENSHOT_MAX_BYTES`. */
export interface ShrinkSteps {
  cap: number
  /** The longest side to start from; a smaller picture keeps its own and is never scaled up. */
  startSide: number
  /** The smallest longest side tried. */
  minSide: number
  /** Re-encode quality, tried from `qualityStart` down by `qualityStep` to `qualityFloor`. */
  qualityStart: number
  qualityStep: number
  qualityFloor: number
  /** Each smaller size is this fraction of the one before, until `minSide`. */
  sideStep: number
}

/** The owner's steps (ticket 1180): 1600 px, quality 0.85 down to 0.5, then smaller down to 800 px. */
export const SCREENSHOT_STEPS: Omit<ShrinkSteps, 'cap'> = {
  startSide: 1600,
  minSide: 800,
  qualityStart: 0.85,
  qualityStep: 0.1,
  qualityFloor: 0.5,
  sideStep: 0.8,
}

/** One encoded try: `size` in bytes, whatever else the encoder keeps (the blob). */
export interface EncodedTry {
  size: number
}

/** The qualities tried at each size: from the start down by the step, ending on the floor. */
function qualities(steps: ShrinkSteps): number[] {
  const list: number[] = []
  for (let quality = steps.qualityStart; quality > steps.qualityFloor + 1e-9; quality -= steps.qualityStep) {
    list.push(Math.round(quality * 100) / 100)
  }
  return [...list, steps.qualityFloor]
}

/** The first encoding at or under `steps.cap`, trying each size from the largest, each at every quality from best to
 * worst; null when none fits (the caller says so in plain words). `encode(width, height, quality)` may answer null
 * for a try it can't make. */
export async function shrinkToFit<T extends EncodedTry>(
  source: { width: number; height: number },
  encode: (width: number, height: number, quality: number) => Promise<T | null>,
  steps: ShrinkSteps,
): Promise<{ encoded: T; width: number; height: number } | null> {
  const longest = Math.max(source.width, source.height)
  let side = Math.min(longest, steps.startSide)
  const floor = Math.min(steps.minSide, side)
  for (;;) {
    const scale = side / longest
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    for (const quality of qualities(steps)) {
      const encoded = await encode(width, height, quality)
      if (encoded && encoded.size <= steps.cap) return { encoded, width, height }
    }
    if (side <= floor) return null
    side = Math.max(floor, Math.round(side * steps.sideStep))
  }
}

/** What picking a picture gives the Feedback sheet: the screenshot to send and its size, or why not. */
export type ScreenshotPick =
  | { ok: true; screenshot: ReportScreenshot; size: number }
  | { ok: false; reason: 'too-detailed' | 'unreadable' }
