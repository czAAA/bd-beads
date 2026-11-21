import { SCREENSHOT_MAX_BYTES, type ScreenshotType } from '../domain/feedbackReport'
import { SCREENSHOT_STEPS, shrinkToFit, type ScreenshotPick } from '../domain/shrinkScreenshot'

// Making a picked picture small enough to send with a Report (ticket 1180): decoded upright, drawn on a canvas and
// re-encoded, which drops every hidden tag (location, camera). The steps are domain/shrinkScreenshot.ts's.

/** The picture upright: a phone photo's rotation is applied, whichever way the browser's own default goes. */
async function decode(file: File): Promise<ImageBitmap | null> {
  for (const options of [{ imageOrientation: 'from-image' as const }, undefined]) {
    try {
      return await createImageBitmap(file, options)
    } catch {
      // Try the next way; a file that is no picture fails both.
    }
  }
  return null
}

function toBlob(canvas: HTMLCanvasElement, type: ScreenshotType, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** WebP where this browser can encode it (Safari answers a PNG for a type it can't), else JPEG. */
async function encodingType(): Promise<ScreenshotType> {
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  return (await toBlob(probe, 'image/webp', 0.8))?.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
}

async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let text = ''
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return btoa(text)
}

/** The picture as a Report's screenshot at most `SCREENSHOT_MAX_BYTES`, or why it can't be one. */
export async function shrinkScreenshot(file: File): Promise<ScreenshotPick> {
  const bitmap = await decode(file)
  if (!bitmap) return { ok: false, reason: 'unreadable' }
  try {
    const type = await encodingType()
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return { ok: false, reason: 'unreadable' }
    const fit = await shrinkToFit(
      bitmap,
      async (width, height, quality) => {
        canvas.width = width
        canvas.height = height
        // A transparent picture would turn black as a JPEG.
        context.fillStyle = '#fff'
        context.fillRect(0, 0, width, height)
        context.drawImage(bitmap, 0, 0, width, height)
        const blob = await toBlob(canvas, type, quality)
        return blob && blob.type === type ? { size: blob.size, blob } : null
      },
      { ...SCREENSHOT_STEPS, cap: SCREENSHOT_MAX_BYTES },
    )
    if (!fit) return { ok: false, reason: 'too-detailed' }
    return { ok: true, screenshot: { type, data: await base64(fit.encoded.blob) }, size: fit.encoded.size }
  } finally {
    bitmap.close()
  }
}
